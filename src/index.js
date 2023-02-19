import {queryDocumentSelectorAll} from '@cocreate/utils';
import action from '@cocreate/actions';

const CoCreateEvents = {
	// ToDo update to support config, ability to add custom prefix, for loop each defualt and custom prefix to support action
	init: function(prefix, events) {
		if (prefix && events)
			this.initElement(document, prefix, events);
		else {
			this.initElement(document, 'toggle', ['click']);
			this.initElement(document, 'click', ['click']);
			// this.initElement(document, 'hover', ['mouseover', 'mouseout');
			// this.initElement(document, 'mouseover', ['mouseover');
			// this.initElement(document, 'mouseout', ['mouseout');
			this.initElement(document, 'input', ['input']);
			this.initElement(document, 'change', ['change']);
			this.initElement(document, 'selected', ['click']);
		}
	},
	
	initElement: function(element, prefix, events) {
		this.__initElementEvent(element || document, prefix, events);
	},
	
	__initElementEvent: function(element, prefix, events) {
		const self = this;
			
		events.forEach((eventName) => {
			let debounce;
			element.addEventListener(eventName, function(event) {
				// ToDo: apply debounce
				clearTimeout(debounce);
				debounce = setTimeout(function() {
					const target = event.target.closest(`[${prefix}], [${prefix}-value]`);
					if (target) {
						let attribute = target.getAttribute('actions') || ""
						if (attribute.includes(prefix))
							return;
						// if (target.closest(`[actions*="${prefix}"]`)) 
						// 	return;
						self.__updateElements(target, prefix);
	
						let parentElement = target.parentElement;
						if (parentElement) {
							do {
								parentElement = parentElement.closest(`[${prefix}], [${prefix}-value]`)
								if (parentElement)
									self.__updateElements(parentElement, prefix);
							}
							while (parentElement)
	
						}
	
					}
					}, 500);

			});
		});

		action.init({
			name: prefix,
			endEvent: `${prefix}End`,
			callback: (btn, data) => {
				this.__updateElements(btn, prefix)
			}
		});

	},
	
	__updateElements: function(element, prefix) {
		const self = this;
		let targetValue = element.getAttribute(`${prefix}-value`) || element.getAttribute(prefix);
		if (!targetValue && element.value)
			targetValue = element.getValue()
		if (!targetValue) return
		
		let values = targetValue.split(',');
		if (!values || values.length == 0) {
			return;
		}

		let targetAttribute = element.getAttribute(`${prefix}-attribute`) || 'class';
		let targetSelector = element.getAttribute(`${prefix}-target`);
		let targetClosest = element.getAttribute(`${prefix}-closest`);
		let targetKey = element.getAttribute(`${prefix}-key`);

		let targetGroup = element.getAttribute(`${prefix}-group`);
		if (targetGroup) {
			document.querySelectorAll(`[${prefix}-group="${targetGroup}"]`).forEach((el) => {
				let groupValue = el.getAttribute(`${prefix}-value`) || el.getAttribute(prefix);
				let groupValues = groupValue.split(',');
				if (!groupValues || groupValues.length == 0) {
					return;
				}
	
				groupValues = groupValues.map(x => x.trim());

				let groupTarget = el.getAttribute(`${prefix}-target`);
				let groupClosest = el.getAttribute(`${prefix}-closest`);
				let groupAttribute = el.getAttribute(`${prefix}-attribute`) || 'class';	
				let groupKey = el.getAttribute(`${prefix}-key`)	

				// el.removeAttribute(prefix)
				self.setValue(prefix, el, groupAttribute, groupValues, groupKey, 'deactivate')
				if (groupTarget)
					document.querySelectorAll(groupTarget).forEach((el) => 
						self.setValue(prefix, el, groupAttribute, groupValues, groupKey, 'deactivate')
					);
				else if (groupClosest) {
					let element = el.closest(groupClosest)
					if (element)
						self.setValue(prefix, element, groupAttribute, groupValues, groupKey, 'deactivate');
				}
			});
		}

		let targetElements = [element];
		if (targetClosest) {
			element = element.closest(targetClosest);
		}
		values = values.map(x => x.trim());
		if (targetSelector) {
			if (/{{\s*([\w\W]+)\s*}}/g.test(targetSelector)) return;
			targetElements = queryDocumentSelectorAll(targetSelector);
			targetElements.forEach((el) => self.setValue(prefix, el, targetAttribute, values, targetKey));
		} else
			self.setValue(prefix, element, targetAttribute, values, targetKey);

		document.dispatchEvent(new CustomEvent(`${prefix}End`, {
			detail: {}
		}))
		
	},
	
	setValue: function(prefix, element, attrName, values, key, deactivate) {
		let attrValues, oldValue;
		if (key) {
			key = `{{${key}}}`;
			// let value = values[0]
			replaceKey(prefix, element, key, values)
		} else {
			if (attrName === 'style') {
				if (element.getAttribute(attrName)) {
					attrValues = element.getAttribute(attrName).split(';').map(x => x.trim());
					attrValues = attrValues.map(function(item, index){
					return item.replace(' ','');
				});
				oldValue = values.filter(x => attrValues.includes(x))[0] || '';
				}
				let newValue = this.__getNextValue(values, oldValue);
				
				if (oldValue) {
					let [property, value] = oldValue.split(":");
					element.style[property] = '';
				}
				
				if (newValue != '') {
					newValue = newValue.split(';').map(x => x.trim())
					for (let style of newValue) {
						let [property, value] = style.split(":");
						element.style[property] = value;
					}
				}
			} else {
				if (attrName === 'value') {
					oldValue = element.getValue()	
				} else if (element.getAttribute(attrName)) {
					attrValues = element.getAttribute(attrName).split(' ').map(x => x.trim());
					oldValue = values.filter(x => attrValues.includes(x))[0] || '';
				}

				let newValue = this.__getNextValue(values, oldValue);
				if (deactivate)
					newValue = ""

				if (attrName === 'class') {
					if (oldValue != '') {
						element.classList.remove(oldValue);
						if (values.length === 1) {
							return;
						}
					}
					
					if (newValue != '') {
						element.classList.add(newValue);
					}
				} else if (attrName === 'value') {
					element.setValue(newValue);
				} else {
					element.setAttribute(attrName, newValue);
				}
			}
		}
	},

	__getNextValue: function(values, val) {
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
const elementPrefix = new Map();
function replaceKey(prefix, element, key, values) {
	// ToDo: improve updating key to prevent unwanted match by storing each attribute that originally had a key to know which attributes to update
	if (eventElements.has(element)) {
		key = eventElements.get(element).get(prefix);
	}
	let oldValue = key
	let value = CoCreateEvents.__getNextValue(values, oldValue);

	const regex = new RegExp(key, "g");
	for (let attribute of element.attributes){
		let attrName = attribute.name;
		let attrValue = attribute.value;
		let setAttr = false;
		if (attrValue.includes(key)){
			attrValue = attrValue.replace(regex, value);
			setAttr = true;
		}
		if (attrName.includes(key)){
			element.removeAttribute(key);
			attrName = attrName.replace(regex, value);
			setAttr = true;
		}
		if (setAttr)
			element.setAttribute(attrName, attrValue);
	}
	let html = element.innerHTML;
	if (html.indexOf(key) !== -1){
		html = html.replace(regex, value);
		element.innerHTML = html;
	}
	elementPrefix.set(prefix, value)
	eventElements.set(element, elementPrefix)
		
}

CoCreateEvents.init();

export default CoCreateEvents;