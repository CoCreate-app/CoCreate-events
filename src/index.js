/********************************************************************************
 * Copyright (C) 2023 CoCreate and Contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 ********************************************************************************/

// Commercial Licensing Information:
// For commercial use of this software without the copyleft provisions of the AGPLv3,
// you must obtain a commercial license from CoCreate LLC.
// For details, visit <https://cocreate.app/licenses/> or contact us at sales@cocreate.app.

import { queryElements, queryData } from "@cocreate/utils";
import action from "@cocreate/actions";
import observer from "@cocreate/observer";
import "@cocreate/element-prototype";

const CoCreateEvents = {
	elements2: new Map(),
	init: function (prefix, events) {
		if (prefix && events) this.initPrefix(prefix, events);
		else {
			this.initPrefix("toggle", ["click"]);
			this.initPrefix("click", ["click"]);
			this.initPrefix("hover", ["mouseover", "mouseout"]);
			this.initPrefix("mouseover", ["mouseover"]);
			this.initPrefix("mouseout", ["mouseout"]);
			this.initPrefix("input", ["input"]);
			this.initPrefix("change", ["change"]);
			this.initPrefix("selected", ["click"]);
			this.initPrefix("onload", ["onload"]);
			this.initPrefix("observe", ["observer"]);
			this.initPrefix("intersection", ["intersection"]);
			this.initPrefix("resize", ["onload", "resize"]);
			this.initPrefix("localstorage", ["onload"]);
			this.initPrefix("focus", ["focus"]);
		}

		let customEventEls = document.querySelectorAll("[event-name]");
		let names = {};
		for (let customEventEl of customEventEls) {
			let name = customEventEl.getAttribute("event-name");
			name = name.split(",");
			for (let i = 0; i < name.length; i++) {
				name[i].trim();
				if (!names[name]) {
					names[name] = name;
					this.initPrefix(name);
				}
			}
		}

		const self = this;
		observer.init({
			name: "CoCreateEventName",
			types: ["addedNodes"],
			selector: `[event-name]`,
			callback: function (mutation) {
				let name = mutation.target.getAttribute("event-name");
				self.initPrefix(name);
			}
		});
	},

	initPrefix: function (prefix, events) {
		const self = this;

		action.init({
			name: prefix,
			endEvent: `${prefix}End`,
			callback: (data) => {
				this.__updateElements(
					data.element,
					prefix,
					null,
					null,
					data.params
				);
			}
		});

		let selector = `[${prefix}], [${prefix}-key], [${prefix}-attribute], [${prefix}-value], [${prefix}-action], [${prefix}-query], [${prefix}-preventDefault], [${prefix}-stopPropagation], [${prefix}-stopImmediatePropagation]`;

		observer.init({
			name: "CoCreateEventattributes",
			types: ["attributes", "addedNodes"],
			attributeFilter: [
				`${prefix}-key`,
				`${prefix}-value`,
				`${prefix}-query`,
				`${prefix}-events`,
				`${prefix}-bubbles`,
				`${prefix}-cancelable`,
				`${prefix}-composed`,
				`${prefix}-preventDefault`,
				`${prefix}-stopPropagation`,
				`${prefix}-stopImmediatePropagation`
			],
			selector,
			callback: function (mutation) {
				self.initElements([mutation.target], prefix, events);
			}
		});

		let elements = document.querySelectorAll(selector);
		this.initElements(elements, prefix, events);
	},

	elements: new Map(),
	initElements: function (elements, prefix, events = []) {
		const self = this;
		for (const el of elements) {
			let isEventable = true;
			let prefixes = this.elements.get(el);
			if (!prefixes) {
				prefixes = { [prefix]: { events } };
				this.elements.set(el, prefixes);
			} else if (!prefixes[prefix]) {
				prefixes[prefix] = { events };
			} else {
				isEventable = false;
			}

			let customEvents = el.getAttribute(`${prefix}-events`);
			if (customEvents) {
				customEvents = customEvents.split(",");
				for (let i = 0; i < customEvents.length; i++)
					customEvents[i] = customEvents[i].trim();

				for (let i = 0; i < events.length; i++)
					el.removeEventListener(events[i], eventFunction);

				events = customEvents;
				prefixes[prefix].events = events;
				isEventable = true;
			}

			if (!events || !isEventable) continue;

			// let originalSelector = ""; // i think we need to extract the selector and remove the operators
			// if (originalSelector) {
			// 	observer.init({
			// 		types: ["addedNodes"],
			// 		callback: function (mutation) {
			// 			const els = el.queryElements();
			// 			if (els && els.includes(mutation.target)) {
			// 				self.__updateElements();
			// 			}
			// 		}
			// 	});
			// }

			if (events.includes("onload")) {
				this.__updateElements(el, prefix);
			}

			if (events.includes("observer")) {
				let target;
				for (let attribute of el.attributes) {
					if (attribute.name === "observe-target") {
						target = attribute.value;
						break;
					} else if ([`${prefix}-query`].includes(attribute.name)) {
						target = attribute.value;
						break;
					}
				}

				let attributeFilter = (
					el.getAttribute(`${prefix}-attributes`) || ""
				)
					.split(/\s*,\s*/)
					.filter((item) => item);

				let observeAttribute = (
					el.getAttribute(`${prefix}-observe`) || ""
				)
					.split(/\s*,\s*/)
					.filter((item) => item);

				let observerConfig = {
					types: observeAttribute,
					callback: function (mutation) {
						self.__updateElements(el, prefix, mutation.target);
					}
				};

				if (target) {
					if (
						target &&
						!observeAttribute.length &&
						!attributeFilter.length
					) {
						observerConfig.types.push("addedNodes");
					}
					observerConfig.target = target;
				}

				if (attributeFilter.length) {
					observerConfig.types.push("attributes");
					observerConfig.attributeFilter = attributeFilter;
				}

				if (observerConfig.types.length) observer.init(observerConfig);
			}

			if (events.includes("resize")) {
				const resizeObserver = new ResizeObserver((entries) => {
					const lastEntry = entries[entries.length - 1];
					const { width, height } = lastEntry.contentRect;
					el.setAttribute(`${prefix}-if-value`, width + "px");
					self.__updateElements(el, prefix);
				});
				resizeObserver.observe(el);
			}

			if (events.includes("intersection")) {
				const rootSelector = el.getAttribute(`${prefix}-root`);
				const rootMargin =
					el.getAttribute(`${prefix}-root-margin`) || "0px";
				const threshold = el.getAttribute(`${prefix}-threshold`)
					? JSON.parse(el.getAttribute(`${prefix}-threshold`))
					: [0];
				const trigger = el.getAttribute(`${prefix}-trigger`) || "both"; // Default to "both"

				// Resolve root from the selector or use null for viewport
				const root = rootSelector
					? document.querySelector(rootSelector)
					: null;

				// Validate and filter threshold values
				const validThreshold = Array.isArray(threshold)
					? threshold.filter((value) => value >= 0 && value <= 1)
					: [0];

				// Create IntersectionObserver
				const intersectionObserver = new IntersectionObserver(
					(entries) => {
						entries.forEach((entry) => {
							const isVisible = entry.isIntersecting;

							// Determine if __updateElements should be called based on trigger
							// if (
							// 	(trigger === "visible" && isVisible) ||
							// 	(trigger === "not-visible" && !isVisible) ||
							// 	trigger === "both"
							// ) {
							if (isVisible) {
								// Set an attribute to reflect visibility state
								el.setAttribute(
									`${prefix}-is-visible`,
									isVisible ? "true" : "false"
								);

								// Call __updateElements
								self.__updateElements(
									el,
									prefix
									// {
									// 	isVisible,
									// 	intersectionRatio:
									// 		entry.intersectionRatio
									// }
								);
							}
						});
					},
					{ root, rootMargin, threshold: validThreshold }
				);

				intersectionObserver.observe(el);
			}

			for (let i = 0; i < events.length; i++) {
				// Skip specific lifecycle events
				if (
					events[i] === "onload" ||
					events[i] === "observer" ||
					events[i] === "intersection" ||
					events[i] === "resize"
				) {
					continue;
				}

				// Remove any existing event listener
				el.removeEventListener(events[i], eventFunction);

				// Initialize an empty options object
				const options = {};

				// Attributes to check dynamically
				const attributes = ["bubbles", "cancelable", "composed"];

				for (let j = 0; j < attributes.length; j++) {
					const attrValue = el.getAttribute(
						`${events[i]}-${attributes[j]}`
					);
					if (attrValue !== null) {
						options[attributes[j]] = attrValue !== "false";
					}
				}

				// Add the new event listener with the dynamically constructed options
				el.addEventListener(events[i], eventFunction, options);
			}

			function eventFunction(event) {
				// TODO: apply debounce.
				// let debounce;
				// clearTimeout(debounce);
				// debounce = setTimeout(function() {
				const target = event.currentTarget;
				if (target) {
					let prefixes = self.elements.get(target);
					if (
						prefixes[prefix].prev === event.type &&
						["mouseover", "mouseout"].includes(event.type)
					)
						return;
					else prefixes[prefix].prev = event.type;

					let attribute = target.getAttribute("actions") || "";
					if (attribute.includes(prefix)) return;
					// if (target.closest(`[actions*="${prefix}"]`))
					// 	return;

					// Define the lifecycle attributes (matching JavaScript event methods)
					const lifecycleAttributes = [
						"preventDefault",
						"stopPropagation",
						"stopImmediatePropagation"
					];

					// Handle lifecycle attributes dynamically
					for (let i = 0; i < lifecycleAttributes.length; i++) {
						const attr = `${prefix}-${lifecycleAttributes[i]}`; // Add prefix dynamically
						const attrValue = target.getAttribute(attr); // Directly get the attribute value

						// If attribute exists and is not explicitly "false", apply the corresponding event method
						if (attrValue !== null && attrValue !== "false") {
							event[lifecycleAttributes[i]]();
						}
					}

					self.__updateElements(
						target,
						prefix,
						null,
						prefixes[prefix].events
					);

					// let selector = `[${prefix}], [${prefix}-key], [${prefix}-value], [${prefix}-query]`

					// let parentElement = target.parentElement;
					// if (parentElement) {
					//     do {
					//         parentElement = parentElement.closest(selector)
					//         if (parentElement) {
					//             self.__updateElements(parentElement, prefix, null, prefixes[prefix].events);
					//             parentElement = parentElement.parentElement
					//         }
					//     }
					//     while (parentElement)

					// }
				}
				// }, 500);
			}
		}
	},

	__updateElements: async function (el, prefix, target, events, params) {
		if (!el.isConnected) return;

		let elements = [el];
		let targetGroup = el.getAttribute(`${prefix}-group`);
		if (targetGroup) {
			document
				.querySelectorAll(`[${prefix}-group="${targetGroup}"]`)
				.forEach((element) => {
					if (element !== el) elements.push(element);
				});
		}

		for (let element of elements) {
			// const requestAnimationFrameAttr = element.getAttribute(
			// 	`${prefix}-requestAnimationFrame`
			// );

			// if (
			// 	requestAnimationFrameAttr !== null &&
			// 	requestAnimationFrameAttr !== "false"
			// ) {
			// 	// Double requestAnimationFrame
			// 	await new Promise((resolve) => {
			// 		requestAnimationFrame(() => {
			// 			requestAnimationFrame(() => {
			// 				resolve();
			// 			});
			// 		});
			// 	});
			// }

			// TODO: Handle setInterval logic
			let delay = element.getAttribute(`${prefix}-setTimeout`);

			if (delay) {
				delay = parseInt(delay, 10) || 0;
				if (delay > 0) {
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}

			if (!element.isConnected) return;

			let once = element.getAttribute(`${prefix}-once`);
			if (once || once === "") {
				if (!element.eventsOnce) {
					element.eventsOnce = [prefix];
				} else if (element.eventsOnce.includes(prefix)) {
					continue;
				} else {
					element.eventsOnce.push(prefix);
				}
			}

			// TODO: support empty value when prefix-attribute defined, add and remove the attribute
			let targetAttribute = element.getAttribute(`${prefix}-attribute`);
			let targetPosition = element.getAttribute(
				`${prefix}-insert-adjacent`
			);
			// targetAttribute = checkMediaQueries(targetAttribute)
			// if (targetAttribute === false)
			//     return

			let onEvent = element.getAttribute(`${prefix}-on`);
			if (onEvent) {
				await new Promise((resolve, reject) => {
					const handleEvent = () => {
						document.removeEventListener(onEvent, handleEvent);
						resolve();
					};
					document.addEventListener(onEvent, handleEvent);
				});
			}

			let values;
			if (prefix === "localstorage") {
				let key = element.getAttribute("localstorage-get");
				if (key) {
					values = localStorage.getItem(key);
				} else if ((key = element.getAttribute("localstorage-set"))) {
					values = await element.getValue();
					if (values) {
						localStorage.setItem(key, values);
					}
				}

				// if (!key || !values)
				if (!key) return;
			} else {
				values = element.getAttribute(`${prefix}-value`);

				if (values === null) {
					let valueElements = queryElements({
						element,
						prefix: `${prefix}-value`
					});
					if (valueElements.length) {
						let elementValues = [];
						for (let i = 0; i < valueElements.length; i++) {
							elementValues.push(valueElements[i].getValue());
						}
						if (elementValues.length) {
							values = elementValues;
						}
					}
				}

				if (values === null) {
					values = element.getAttribute(`${prefix}-if-value`);
				}
				if (values === null) {
					values = element.getAttribute(prefix);
				}
			}

			if (values || values === "") {
				if (typeof values === "string") {
					values = values.split(",");
				} else if (!Array.isArray(values)) {
					values = [values];
				}
			} else {
				values = await element.getValue();
				if (!Array.isArray(values)) {
					values = [values];
				}
			}

			if ((targetAttribute && !values) || values.length === 0) {
				return;
			}

			let ifCondition = element.getAttribute(`${prefix}-if`);
			let elseCondition = element.getAttribute(`${prefix}-else`);

			let ifValue = element.getAttribute(`${prefix}-if-value`);
			if (ifCondition) {
				if (!ifValue && ifValue !== "")
					ifValue = (await element.getValue()) || values;
				//values // await element.getValue()
				else if (ifValue || ifValue === "") {
					ifValue = [ifValue];
				} else {
					ifValue = values;
				}

				if (!Array.isArray(ifValue)) {
					ifValue = [ifValue];
				}
			}

			//TODO: improved resize toggling of values
			// let hasCondition = this.elements2.get(element)
			if (ifCondition) {
				if (evaluateCondition(ifCondition, ifValue)) {
					// Action 1: Condition exists and evaluates true
					// console.log("Executing Action 1 for ifCondition:", ifCondition); // Optional debug log
					// Replace this comment with your actual code for Path 1
					// e.g., this.elements2.set(element, { condition: ifCondition });

					// Assuming we stop processing for this element once a condition is met and actioned
					return;
				} else {
					// Condition existed but evaluated false. Stop processing.
					// Corresponds to the original `else if (ifCondition || elseCondition) { return; }` for the ifCondition case
					return;
				}
			}

			// If we reach here, ifCondition was falsy (didn't exist)
			// Now check the 'else' condition
			if (elseCondition) {
				if (evaluateCondition(elseCondition, ifValue)) {
					// Action 2: Condition exists and evaluates true
					// console.log("Executing Action 2 for elseCondition:", elseCondition); // Optional debug log
					// Replace this comment with your actual code for Path 2
					// e.g., this.elements2.set(element, { condition: elseCondition });

					// Assuming we stop processing for this element once a condition is met and actioned
					return;
				} else {
					// Condition existed but evaluated false. Stop processing.
					// Corresponds to the original `else if (ifCondition || elseCondition) { return; }` for the elseCondition case
					return;
				}
			}

			let targetText = element.getAttribute(`${prefix}-text`);
			let targetHtml = element.getAttribute(`${prefix}-html`);
			let targetKey = element.getAttribute(`${prefix}-key`);

			if (prefix === "selected") {
				if (el !== element) {
					element.removeAttribute("selected");
				} else {
					element.setAttribute("selected", "");
				}
			}

			let deactivate = false;
			if (el !== element) {
				deactivate = true;
			}
			// values = values.map(x => x.trim());

			values = values.map((x) => {
				if (typeof x === "string") x = x.trim(); // Update x with the trimmed value
				let prop = element.getAttribute(`${prefix}-property`);
				if (prop) {
					x = `${prop}:${x}`; // Update x with prop if it exists
				}
				return x; // Return the updated x
			});
			let targetElements;
			if (element.hasAttribute(`${prefix}-query`)) {
				targetElements = queryElements({
					element,
					prefix,
					selector: params
				});
			} else {
				targetElements = [element];
			}

			let action = element.getAttribute(`${prefix}-action`);
			for (let i = 0; i < targetElements.length; i++) {
				if (action) {
					targetElements[i][action]();
				} else if (
					!targetAttribute &&
					targetAttribute !== "" &&
					!targetPosition &&
					["click", "focus", "blur"].includes(prefix)
				) {
					// TODO: click causes an infinite loop if targetElement[i] is a child of element do to event propactaion
					if (
						(targetElements[i] === element &&
							element.hasAttribute(prefix)) ||
						(params &&
							targetElements[i] !== element &&
							!element.contains(targetElements[i]))
					)
						targetElements[i][prefix]();
				} else {
					this.setValue(
						prefix,
						targetElements[i],
						targetAttribute,
						values,
						targetKey,
						deactivate,
						events,
						targetPosition
					);
				}
			}
		}

		el.dispatchEvent(
			new CustomEvent(`${prefix}End`, {
				detail: {}
			})
		);
	},

	setValue: async function (
		prefix,
		element,
		attrName,
		values,
		key,
		deactivate,
		events,
		targetPosition
	) {
		if (events && events.includes("mouseout")) {
			if (element.matches(":hover")) {
				element.addEventListener(
					"mouseout",
					() => {
						this.setValue(
							prefix,
							element,
							attrName,
							values,
							key,
							deactivate,
							events,
							targetPosition
						);
					},
					{ once: true }
				);
				return;
			}
		}

		let attrValues, oldValue;
		if (key) {
			key = `{{${key}}}`;
			// let value = values[0]
			replaceKey(prefix, element, key, values);
		} else {
			// TODO: if html in iframe
			let domTextEditor;
			if (element.parentElement) {
				domTextEditor =
					element.parentElement.closest("[contenteditable]");
			}

			if (attrName === "style") {
				if (element.getAttribute(attrName)) {
					attrValues = element
						.getAttribute(attrName)
						.split(";")
						.map((x) => x.trim());
					attrValues = attrValues.map(function (item, index) {
						return item.replace(" ", "");
					});
					oldValue =
						values.filter((x) => attrValues.includes(x))[0] || "";
				}
				let newValue = this.__getNextValue(values, oldValue);

				if (oldValue) {
					let [property, value] = oldValue.split(":");
					element.style[property] = "";
				}

				if (newValue != "") {
					newValue = newValue.split(";").map((x) => x.trim());
					for (let style of newValue) {
						let [property, value] = style.split(":");
						element.style[property] = value;
					}
				}
			} else {
				if (attrName === "value") {
					oldValue = await element.getValue();
				} else if (
					attrName === "text" ||
					attrName === "html" ||
					element.getAttribute(attrName)
				) {
					attrValues = element
						.getAttribute(attrName)
						.split(" ")
						.map((x) => x.trim());
					oldValue =
						values.filter((x) => attrValues.includes(x))[0] || "";
				}

				let newValue = this.__getNextValue(values, oldValue);
				if (deactivate) newValue = "";
				if (attrName === "class") {
					if (oldValue) {
						element.classList.remove(oldValue);
						if (values.length === 1) {
							return;
						}
					}

					if (newValue) {
						element.classList.add(newValue);
					}
				} else if (attrName === "value") {
					element.setValue(newValue, false);
				} else if (
					["$click", "$focus", "$blur", "$save", "$read"].includes(
						attrName
					)
				) {
					element[attrName.substring(1)]();
				} else if (attrName) {
					// TODO: removeAttribute vs setting empty value, how best to define. operator $remove ???
					if (newValue === "" && element.hasAttribute(attrName))
						element.removeAttribute(attrName);
					else element.setAttribute(attrName, newValue);
				} else if (targetPosition) {
					if (domTextEditor) {
						CoCreate.text.insertAdjacentElement({
							domTextEditor,
							position: targetPosition,
							target: element,
							elementValue: newValue
						});
					} else if (targetPosition === "replace") {
						element.insertAdjacentHTML("beforebegin", newValue); // Insert before oldElement
						element.remove(); // Remove oldElement
					} else {
						element.insertAdjacentHTML(targetPosition, newValue);
					}
				} else {
					if (
						!attrName &&
						["click", "focus", "blur"].includes(newValue)
					) {
						element[newValue]();
					} else if (["click", "focus", "blur"].includes(attrName)) {
						element[attrName]();
					}
				}
			}
		}
	},

	__getNextValue: function (values, val) {
		let size = values.length;
		let nn = values.indexOf(val);
		if (nn == -1) {
			return values[0];
		} else {
			return values[(nn + 1) % size];
		}
	}
};

const eventElements = new Map();
const eventKeys = new Map();
const elementAttributes = new Map();

function replaceKey(prefix, element, key, values) {
	let currentValue = key;

	if (eventElements.has(element)) {
		currentValue = eventElements.get(element).get(key);
	}
	let value = CoCreateEvents.__getNextValue(values, currentValue);
	eventKeys.set(key, value);
	eventElements.set(element, eventKeys);

	let attributes = elementAttributes.get(element);
	if (!attributes) {
		attributes = {};
		elementAttributes.set(element, attributes);
	}

	for (let attribute of element.attributes) {
		let newName = attribute.name;
		let newValue = attribute.value;
		let attrName = attribute.name;
		let attrValue = attribute.value;
		let setAttr = false;

		if (attrName === "clone-data") console.log("clone-data");
		if (
			attrValue.includes(currentValue) ||
			(attributes[attrName] &&
				attributes[attrName].valueKeys &&
				attributes[attrName].valueKeys[key])
		) {
			if (!attributes[attrName])
				attributes[attrName] = { originalValue: attrValue };
			else if (!attributes[attrName].originalValue)
				attributes[attrName].originalValue = attrValue;
			if (!attributes[attrName].valueKeys)
				attributes[attrName].valueKeys = { [key]: value };
			else attributes[attrName].valueKeys[key] = value;

			newValue = attributes[attrName].originalValue;
			for (let valueKey of Object.keys(attributes[attrName].valueKeys)) {
				const valueKeyRegex = new RegExp(valueKey, "g");
				newValue = newValue.replace(valueKeyRegex, value);
			}
			setAttr = true;
		}
		// if (attrName.includes(currentValue) || attributes[attrName] && attributes[attrName].nameKeys && attributes[attrName].nameKeys[key]){
		// 	if (!attributes[attrName])
		// 		attributes[attrName] = { originalName: attrName }
		// 	else if (!attributes[attrName].originalName)
		// 		attributes[attrName].originalName = attrName

		// 	if (!attributes[attrName].nameKeys)
		// 		attributes[attrName].nameKeys = {[key]: value}

		// 	newName = attributes[attrName].originalName
		// 	for (let nameKey of Object.keys(attributes[attrName].nameKeys)) {
		// 		let r
		// 		if (attrName === nameKey)
		// 			r = nameKey
		// 		else
		// 			r = attributes[attrName].nameKeys[nameKey]

		// 		const nameKeyRegex = new RegExp(r, "g");
		// 		newName = newName.replace(nameKeyRegex, value);
		// 	}

		// 	attributes[attrName].nameKeys[key] = value;

		// 	element.removeAttribute(attrName);
		// 	setAttr = true;

		// }
		if (setAttr) element.setAttribute(newName, newValue);
	}
	let html = element.innerHTML;
	if (
		html.indexOf(currentValue) !== -1 ||
		(element.htmlKeys && element.htmlKeys[key])
	) {
		if (!element.originalHtml) element.originalHtml = html;
		if (!element.htmlKeys) element.htmlKeys = { [key]: value };
		else element.htmlKeys[key] = value;

		let newHTML = element.originalHtml;
		if (newHTML) {
			for (let elementKey of Object.keys(element.htmlKeys)) {
				const htmlKeyRegex = new RegExp(elementKey, "g");
				newHTML = newHTML.replace(htmlKeyRegex, value);
			}

			element.innerHTML = newHTML;
		}
	}
}

function evaluateCondition(condition, values) {
	let orConditions = condition.split(/\s*\|\|\s*/);

	if (orConditions.length > 1) {
		return orConditions.some((cond) => checkCondition(cond, values));
	} else {
		let andConditions = condition.split(/\s*&&\s*/);
		return andConditions.every((cond) => checkCondition(cond, values));
	}
}

function checkCondition(condition, value) {
	let isNegated = condition.startsWith("!");
	if (isNegated) {
		condition = condition.substring(1);
	}
	const operatorMatch = condition.match(/(<=|>=|<|>)(.+)/);
	if (operatorMatch) condition = operatorMatch[2].trim();

	let parse = true;
	if (condition === "true") {
		return !!value[0];
	} else if (condition === "false") {
		return !value[0];
	}
	// else if (condition === "[]" && typeof value[0] === "string") {
	// 	parse = false;
	// }

	// TODO: why parse updated conditin to boolean false
	// if (parse && condition !== "false") condition = parseCondition(condition);

	if (typeof value[0] === "number") {
		condition = parseNumberCondition(condition);
	} else if (typeof value[0] === "object" && typeof condition === "string") {
		condition = parseJsonCondition(condition);
	}

	let result;

	if (condition === "$template") {
		result = /{{\s*([\w\W]+)\s*}}/g.test(value[0]);
	} else if (Array.isArray(value) && !(typeof condition === "object")) {
		if (operatorMatch) {
			condition = parseFloat(condition);
			result = value.some((v) => {
				v = parseFloat(v);
				switch (operatorMatch[1]) {
					case "<":
						return v < condition;
					case ">":
						return v > condition;
					case "<=":
						return v <= condition;
					case ">=":
						return v >= condition;
					default:
						return false;
				}
			});
		} else result = value.includes(condition);
	} else if (Array.isArray(value)) {
		// TODO: handle comparing array to array, vs querying the array items for a match
		result = queryData(value, condition);
	} else if (
		typeof value === "object" &&
		value !== null &&
		typeof parsedCond === "object"
	) {
		result = queryData(value, condition);
	} else {
		result = value === condition;
	}

	result = isNegated ? !result : result;
	return result;
}

function parseJsonCondition(condition) {
	try {
		// Attempt to parse the condition as JSON
		let parsedJson = JSON.parse(condition);
		return parsedJson;
	} catch (e) {
		return condition;
	}
}
function parseNumberCondition(condition) {
	return !isNaN(condition) && condition.trim() !== ""
		? Number(condition)
		: condition;
}

// Helper function for delay using Promises
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for a specific element property to meet a readiness condition,
 * based on retry attributes defined on the element.
 * Incorporates optional exponential backoff for retry delays.
 * Returns a Promise that resolves to true if the condition is met within
 * the allowed attempts, and false otherwise.
 *
 * @param {HTMLElement} element The element with the onload-retry-* attributes.
 * @returns {Promise<boolean>} A Promise resolving to true if ready, false if timed out.
 */
async function checkElementReadinessWithBackoff(element) {
	const propertyName = element.getAttribute("onload-retry-property");

	if (!propertyName) {
		return true; // No retry needed
	}

	// --- Retry Parameters ---
	const maxAttempts =
		parseInt(element.getAttribute("onload-retry-attempts") || "3", 10) || 3;
	// Initial delay (used for the first wait and as the base for backoff)
	const initialDelayMs =
		parseInt(element.getAttribute("onload-retry-delay") || "100", 10) ||
		100;
	// Exponential backoff factor (e.g., 2 for doubling). <= 1 means fixed delay.
	// Default to 1 (no backoff) if missing or invalid.
	const backoffFactor =
		parseFloat(
			element.getAttribute("onload-retry-backoff-factor") || "1"
		) || 1;
	// Optional maximum delay cap. Use Infinity if missing, invalid, or <= 0.
	const maxDelayMs = parseInt(
		element.getAttribute("onload-retry-max-delay") || "0",
		10
	);
	const effectiveMaxDelay =
		maxDelayMs && maxDelayMs > 0 ? maxDelayMs : Infinity;

	console.log(
		`Checking readiness for property "${propertyName}" on element ${
			element.id || ""
		}. Max attempts: ${maxAttempts}, Initial Delay: ${initialDelayMs}ms, Backoff Factor: ${backoffFactor}, Max Delay: ${
			effectiveMaxDelay === Infinity ? "None" : effectiveMaxDelay + "ms"
		}.`
	);

	// Initialize the delay to be used for the *first* wait.
	let currentDelay = initialDelayMs;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		console.log(
			`Attempt ${attempt}/${maxAttempts}: Checking "${propertyName}"...`
		);
		try {
			const propertyValue = element[propertyName];
			// Example check: Adjust condition as needed
			if (propertyValue !== undefined && propertyValue > 0) {
				console.log(
					`Property "${propertyName}" ready on attempt ${attempt}. Value: ${propertyValue}`
				);
				return true; // Condition met
			}
		} catch (error) {
			console.error(
				`Error accessing property "${propertyName}" on attempt ${attempt}:`,
				error
			);
		}

		// If condition not met and more attempts remain:
		if (attempt < maxAttempts) {
			// Determine the actual delay for this wait, applying the cap
			const delayForThisWait = Math.min(currentDelay, effectiveMaxDelay);

			console.log(
				`Waiting ${Math.round(
					delayForThisWait
				)}ms before next attempt...`
			);
			await delay(delayForThisWait);

			// Calculate the delay for the *next* potential wait, only if backoff is active
			if (backoffFactor > 1) {
				currentDelay = currentDelay * backoffFactor;
				// Note: We apply the cap just before the actual delay,
				// but the base 'currentDelay' keeps growing exponentially.
				// Alternatively, you could cap 'currentDelay' itself here:
				// currentDelay = Math.min(currentDelay * backoffFactor, effectiveMaxDelay);
				// Let's stick to capping just before delay() for now.
			}
			// If backoffFactor <= 1, currentDelay remains initialDelayMs (implicitly handled by initialization)
		}
	}

	// If loop finishes without condition being met
	console.warn(
		`Readiness check failed for property "${propertyName}" on element ${
			element.id || ""
		} after ${maxAttempts} attempts.`
	);
	return false; // Timed out
}

// --- Example Usage (calling code doesn't change) ---

async function handleElementProcessingWithBackoff(element) {
	// Call the function that now supports backoff
	const isReady = await checkElementReadinessWithBackoff(element);

	if (isReady) {
		console.log(
			`Element ${element.id || ""} is ready. Proceeding with actions.`
		);
		// --- Execute subsequent actions ---
		if (element.hasAttribute("onload-attribute")) {
			/* ... */
		}
		if (element.hasAttribute("onload-query")) {
			/* ... */
		}
	} else {
		console.warn(
			`Skipping actions for element ${
				element.id || ""
			} because readiness check failed.`
		);
	}
}

// --- Example Elements ---

// With Backoff (Delays: 100, 200, 400, 800 - capped)
// <span id="elem1" onload-retry-property="scrollWidth"
//   onload-retry-attempts="5" onload-retry-delay="100"
//   onload-retry-backoff-factor="2" onload-retry-max-delay="500">
//   Content 1
// </span>
// Waits would be: 100ms, 200ms, 400ms, 500ms (capped)

// No Backoff (factor missing/invalid/<=1)
// <span id="elem2" onload-retry-property="clientHeight"
//   onload-retry-attempts="4" onload-retry-delay="300">
//   Content 2
// </span>
// Waits would be: 300ms, 300ms, 300ms

// const element1 = document.getElementById('elem1');
// if (element1) handleElementProcessingWithBackoff(element1);
// const element2 = document.getElementById('elem2');
// if (element2) handleElementProcessingWithBackoff(element2);

CoCreateEvents.init();

export default CoCreateEvents;
