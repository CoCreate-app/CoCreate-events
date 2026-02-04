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
        if (prefix && events) {
            this.initPrefix(prefix, events);
        } else {
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
            this.initPrefix("blur", ["blur"]);
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
        
        // We look for the prefix as an attribute, or common options
        let selector = `[${prefix}], [${prefix}\\.group], [${prefix}\\.query]`;

        observer.init({
            name: "CoCreateEventAttributes",
            types: ["attributes", "addedNodes"],
            // removed attributeFilter to allow discovery of dynamic attributes (prefix-src, prefix.option, etc.)
            selector,
            callback: function (mutation) {
                // Filter relevant mutations here since attributeFilter is gone
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName.startsWith(prefix)) {
                        self.initElements([mutation.target], prefix, events);
                    }
                } else {
                    self.initElements([mutation.target], prefix, events);
                }
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

            let customEvents = el.getAttribute(`${prefix}.events`);
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

            if (events.includes("onload")) {
                this.__updateElements(el, prefix);
            }

            if (events.includes("observer")) {
                let observerSelector = (
                    el.getAttribute(`${prefix}.selector`) || 
                    el.getAttribute(`${prefix}.query`) || ""
                )

                let attributeFilter = (
                    el.getAttribute(`${prefix}.attributeFilter`) || ""
                )
                    .split(/\s*,\s*/)
                    .filter((item) => item);

                let observerTypes = (
                    el.getAttribute(`${prefix}.types`) || ""
                )
                    .split(/\s*,\s*/)
                    .filter((item) => item);

                let observerConfig = {
                    types: observerTypes,
                    callback: function (mutation) {
                        self.__updateElements(el, prefix);
                    }
                };

                if (observerSelector) {
                    if (!observerTypes.length &&
                        !attributeFilter.length
                    ) {
                       observerConfig.types.push("addedNodes");
                    }
                    observerConfig.selector = observerSelector;
                }

                if (attributeFilter.length) {
                    observerConfig.types.push("attributes");
                    observerConfig.attributeFilter = attributeFilter;
                }

                if (observerConfig.types.length) {
                    observer.init(observerConfig);
                }
            }

            if (events.includes("resize")) {
                const resizeObserver = new ResizeObserver((entries) => {
                    const lastEntry = entries[entries.length - 1];
                    const { width, height } = lastEntry.contentRect;
                    // Note: We're setting a standard attribute here for use by logic later
                    el.setAttribute(`${prefix}-if-value`, width + "px"); 
                    self.__updateElements(el, prefix);
                });
                resizeObserver.observe(el);
            }

            if (events.includes("intersection")) {
                const rootSelector = el.getAttribute(`${prefix}.root`);
                const rootMargin =
                    el.getAttribute(`${prefix}.rootMargin`) || "0px";
                const threshold = el.getAttribute(`${prefix}.threshold`)
                    ? JSON.parse(el.getAttribute(`${prefix}.threshold`))
                    : [0];
                const trigger = el.getAttribute(`${prefix}.trigger`) || "both"; // Default to "both"

                const root = rootSelector
                    ? document.querySelector(rootSelector)
                    : null;

                const validThreshold = Array.isArray(threshold)
                    ? threshold.filter((value) => value >= 0 && value <= 1)
                    : [0];

                const onceAttr = el.getAttribute(`${prefix}.once`);
                const once = onceAttr !== null && onceAttr !== "false";

                const intersectionObserver = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            const isVisible = entry.isIntersecting;

                            if (
                                (trigger === "visible" && isVisible) ||
                                (trigger === "not-visible" && !isVisible) ||
                                trigger === "both"
                            ) {
                                el.setAttribute(
                                    `${prefix}-is-visible`,
                                    isVisible ? "true" : "false"
                                );

                                self.__updateElements(
                                    el,
                                    prefix
                                );
                                
                                if (once) {
                                    intersectionObserver.unobserve(entry.target);
                                }
                            }
                        });
                    },
                    { root, rootMargin, threshold: validThreshold }
                );

                intersectionObserver.observe(el);
            }

            for (let i = 0; i < events.length; i++) {
                if (
                    events[i] === "onload" ||
                    events[i] === "observer" ||
                    events[i] === "intersection" ||
                    events[i] === "resize"
                ) {
                    continue;
                }

                el.removeEventListener(events[i], eventFunction);

                const options = {};
                // Updated to use dot notation for event options
                const attributes = ["bubbles", "cancelable", "composed"];

                for (let j = 0; j < attributes.length; j++) {
                    const attrValue = el.getAttribute(
                        `${events[i]}.${attributes[j]}`
                    );
                    if (attrValue !== null) {
                        options[attributes[j]] = attrValue !== "false";
                    }
                }

                el.addEventListener(events[i], eventFunction, options);
            }

            function eventFunction(event) {
                const target = event.currentTarget;
                if (target) {
                    let prefixes = self.elements.get(target);
                    if (
                        prefixes[prefix].prev === event.type &&
                        ["mouseover", "mouseout"].includes(event.type)
                    )
                        return;
                    else prefixes[prefix].prev = event.type;

                    // Updated to use dot notation for 'actions' attribute check if applicable
                    let attribute = target.getAttribute("actions") || "";
                    if (attribute.includes(prefix)) return;

                    // Handle lifecycle using dot notation
                    const lifecycleAttributes = [
                        "preventDefault",
                        "stopPropagation",
                        "stopImmediatePropagation"
                    ];

                    for (let i = 0; i < lifecycleAttributes.length; i++) {
                        const attr = `${prefix}.${lifecycleAttributes[i]}`;
                        const attrValue = target.getAttribute(attr);

                        if (attrValue !== null && attrValue !== "false") {
                            event[lifecycleAttributes[i]]();
                        }
                    }

                    self.__updateElements(
                        target,
                        prefix,
                        prefixes[prefix].events
                    );
                }
            }
        }
    },

    __updateElements: async function (rootElement, prefix, events, params) {
        if (!rootElement.isConnected) return;

        // 1. Determine targets based on prefix.group option
        let sourceElements = [rootElement];
        let sourceGroup = rootElement.getAttribute(`${prefix}.group`);
        if (sourceGroup) {
            // Looking for targets that identify with this group
            // Using dot notation for the target marker as well for consistency
            sourceElements = document.querySelectorAll(`[${prefix}\\.group="${sourceGroup}"]`);
            // sourceElements = queryElements({
            //     element: rootElement,
            //     selector: `[${prefix}\\.group="${sourceGroup}"]`
            // });
        }

        // 2. Iterate through sourceElements
        for (let sourceElement of sourceElements) {
            
            // Handle Global Options for this sourceElement processing

            // onEvent
            let onEvent = sourceElement.getAttribute(`${prefix}.on`);
            if (onEvent) {
                await new Promise((resolve, reject) => {
                    const handleEvent = () => {
                        document.removeEventListener(onEvent, handleEvent);
                        resolve();
                    };
                    document.addEventListener(onEvent, handleEvent);
                });
            }

            // setInterval
            let interval = sourceElement.getAttribute(`${prefix}.setInterval`);
            if (interval !== null) {
                let intervalMs = parseInt(interval, 10) || 0;
                if (!sourceElement.eventsInterval) {
                    sourceElement.eventsInterval = {};
                }
                let intervalEntry = sourceElement.eventsInterval[prefix];
                if (intervalMs > 0) {
                    if (!intervalEntry || intervalEntry.delay !== intervalMs) {
                        if (intervalEntry) {
                            clearInterval(intervalEntry.id);
                        }
                        sourceElement.eventsInterval[prefix] = {
                            delay: intervalMs,
                            id: setInterval(() => {
                                if (!sourceElement.isConnected) {
                                    const entry =
                                        sourceElement.eventsInterval &&
                                        sourceElement.eventsInterval[prefix];
                                    if (entry) {
                                        clearInterval(entry.id);
                                        delete sourceElement.eventsInterval[prefix];
                                    }
                                    return;
                                }
                                // Recursive call for interval
                                this.__updateElements(
                                    rootElement,
                                    prefix,
                                    events,
                                    params
                                );
                            }, intervalMs)
                        };
                    }
                } else if (intervalEntry) {
                    clearInterval(intervalEntry.id);
                    delete sourceElement.eventsInterval[prefix];
                }
            }

            // setTimeout
            let delayTime = sourceElement.getAttribute(`${prefix}.setTimeout`);
            if (delayTime) {
                delayTime = parseInt(delayTime, 10) || 0;
                if (delayTime > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delayTime));
                }
            }

            if (!sourceElement.isConnected) return;

            // once
            let once = sourceElement.getAttribute(`${prefix}.once`);
            if (once || once === "") {
                if (!sourceElement.eventsOnce) {
                    sourceElement.eventsOnce = [prefix];
                } else if (sourceElement.eventsOnce.includes(prefix)) {
                    continue;
                } else {
                    sourceElement.eventsOnce.push(prefix);
                }
            }
            
            // --- Resolve Targets (Look up query) ---
            // We check for query on the sourceElement to see if targets should be redirected
            let querySelector = sourceElement.getAttribute(`${prefix}.query`);
            
            // Reset targets to sourceElement by default or use query
            let targetElements = [sourceElement];
            
            // If query exists or we have params, resolve targets
            if (querySelector || params) {
                targetElements = queryElements({
                    element: sourceElement,
                    prefix: prefix,
                    selector: querySelector || params 
                });
            }

            // --- 6. Execute Action on Targets ---
            for (let targetElement of targetElements) {
                await this.setValue(
                    rootElement, 
                    sourceElement, 
                    targetElement,
                    prefix,
                    events
                );
            }

        }

        rootElement.dispatchEvent(
            new CustomEvent(`${prefix}End`, {
                detail: {}
            })
        );
    },

    setValue: async function (
        rootElement, 
        sourceElement, 
        targetElement,
        prefix,
        events
    ) {
        if (events && events.includes("mouseout")) {
            if (targetElement.matches(":hover")) {
                targetElement.addEventListener(
                    "mouseout",
                    () => {
                        this.setValue(
                            rootElement, 
                            sourceElement, 
                            targetElement,
                            prefix,
                            events
                        );
                    },
                    { once: true }
                );
                return;
            }
        }

        let deactivate = false;
        if (rootElement !== sourceElement) {
            deactivate = true;
        }

        // 3. Iterate Attributes of the Source Element (el) in order
        for (let attribute of sourceElement.attributes) {
            const name = attribute.name;
            
            // Optimization: Skip attributes that don't match the prefix
            // UPDATED: All checks below use lowercase because DOM attribute iteration is lowercase
            if (!name.startsWith(prefix)
                || name.length <= prefix.length + 1 
                || name === `${prefix}.on`
                || name === `${prefix}.settimeout`
                || name === `${prefix}.setinterval`
                || name === `${prefix}.once`
                || name === `${prefix}.group`
                || name === `${prefix}.query`
                || name === `${prefix}.root`
                || name === `${prefix}.rootmargin`
                || name === `${prefix}.threshold`
                || name === `${prefix}.trigger`
                || name === `${prefix}.selector`
                || name === `${prefix}.attributefilter`
                || name === `${prefix}.types`
                || name === `${prefix}.bubbles`
                || name === `${prefix}.cancelable`
                || name === `${prefix}.composed`
                || name === `${prefix}.preventdefault`
                || name === `${prefix}.stoppropagation`
                || name === `${prefix}.stopimmediatepropagation`
                // Skip .position option as well since it's used as config
                || name === `${prefix}.position`) {
                continue;
            }

            // Parse Target Name and Type
            let targetName = name.substring(prefix.length + 1);
            let separator = name[prefix.length]; // '.' or '-'

            let value = attribute.value;
            if (!value && sourceElement && sourceElement.getValue) {
                value = await sourceElement.getValue();
            }

            // Parse comma-separated values to support rotation
            let values = [];
            if (typeof value === 'string') {
                values = value.split(',').map(v => v.trim());
            } else if (Array.isArray(value)) {
                values = value;
            } else {
                values = [value];
            }
            
            let oldValue = "";
            let newValue = "";

            switch (targetName) {
                case 'style':
                    if (targetElement.getAttribute("style")) {
                        let styles = targetElement.getAttribute("style").split(";").map(x => x.trim().replace(/\s/g, ""));
                        oldValue = values.find(x => styles.includes(x.replace(/\s/g, ""))) || "";
                    }
                    newValue = this.__getNextValue(values, oldValue, deactivate);

                    if (oldValue) {
                        let [prop, val] = oldValue.split(":");
                        if (prop) targetElement.style[prop.trim()] = "";
                    }
                    
                    if (newValue) {
                        let styles = newValue.split(";");
                        for(let s of styles) {
                            let [prop, val] = s.split(":");
                            if (prop && val) targetElement.style[prop.trim()] = val.trim();
                        }
                    }
                    break;

                case 'class':
                    let currentClasses = Array.from(targetElement.classList);
                    oldValue = values.find(val => {
                        let requiredClasses = val.split(" ");
                        return requiredClasses.every(c => currentClasses.includes(c));
                    }) || "";

                    newValue = this.__getNextValue(values, oldValue, deactivate);

                    if (oldValue) {
                        oldValue.split(" ").forEach(c => targetElement.classList.remove(c));
                        if (values.length === 1) return;
                    }

                    if (newValue) {
                        newValue.split(" ").forEach(c => targetElement.classList.add(c));
                    }
                    break;

                // UPDATED: Added lowercase cases for HTML compatibility
                case 'insertadjacenthtml':
                case 'insertadjacenttext':
                case 'insertAdjacentHTML':
                case 'insertAdjacentText':
                    // 1. Get Position from Attribute Value (No rotation, strict)
                    let position = attribute.value;
                    if (!position) return;

                    // 2. Get Content from Source Element
                    let content = "";
                    if (sourceElement && sourceElement.getValue) {
                        content = await sourceElement.getValue();
                    }

                    // 3. Execute Insertion
                    // Check for CoCreate Rich Text integration
                    let domTextEditor;
                    if (targetElement.parentElement) {
                        domTextEditor = targetElement.parentElement.closest("[contenteditable]");
                    }

                    if (domTextEditor && typeof CoCreate !== 'undefined' && CoCreate.text) {
                        CoCreate.text.insertAdjacentElement({
                            domTextEditor,
                            position: position,
                            target: targetElement,
                            elementValue: content
                        });
                    } else {
                        // Standard JS Execution
                        // Check lowercase match since switch case might have matched that
                        if (targetName === 'insertAdjacentHTML' || targetName === 'insertadjacenthtml') {
                            targetElement.insertAdjacentHTML(position, content);
                        } else {
                            targetElement.insertAdjacentText(position, content);
                        }
                    }
                    break;

                case 'value':
                    if (targetElement.getValue) {
                        oldValue = await targetElement.getValue();
                    } else {
                        oldValue = targetElement.value;
                    }
                    if (!values.includes(oldValue)) oldValue = "";
                    newValue = this.__getNextValue(values, oldValue, deactivate);
                    
                    if (targetElement.setValue) {
                        targetElement.setValue(newValue);
                    } else {
                        targetElement.value = newValue;
                    }
                    break;

                default:
                    if (separator === '.') {
                        // Dot Notation: Property or Method
                        if (targetElement[targetName] !== undefined) {
                            // It's a property or function
                            oldValue = targetElement[targetName];
                            if (!values.includes(oldValue)) oldValue = "";
                            newValue = this.__getNextValue(values, oldValue, deactivate);
        
                            if (typeof targetElement[targetName] === 'function') {
                                targetElement[targetName](newValue);
                            } else {
                                targetElement[targetName] = newValue;
                            }
                        }
                    } else {
                        // Dash Notation: Attribute
                        // Fallback to attribute
                        oldValue = targetElement.getAttribute(targetName);
                        if (!values.includes(oldValue)) oldValue = "";
                        newValue = this.__getNextValue(values, oldValue, deactivate);

                        // Set Attribute with Namespace check
                        if (targetName.includes('.')) {
                            const realName = targetName.replace('.', ':');
                            targetElement.setAttribute(realName, newValue);
                        } else if (targetName.includes(':')) {
                            targetElement.setAttribute(targetName, newValue); 
                        } else {
                            targetElement.setAttribute(targetName, newValue);
                        }
                    }
                    break;
            }
        }

    },

    __getNextValue: function (values, val, deativate) {
        if (deativate) return "";
        let size = values.length;
        let nn = values.indexOf(val);
        if (nn == -1) {
            return values[0];
        } else {
            return values[(nn + 1) % size];
        }
    }
};

CoCreateEvents.init();

export default CoCreateEvents;