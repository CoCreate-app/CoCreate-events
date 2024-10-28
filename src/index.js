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

import { queryElements, queryData } from '@cocreate/utils';
import action from '@cocreate/actions';
import observer from '@cocreate/observer';
import '@cocreate/element-prototype';

const CoCreateEvents = {
    elements2: new Map(),
    init: function (prefix, events) {
        if (prefix && events)
            this.initPrefix(prefix, events);
        else {
            this.initPrefix('toggle', ['click']);
            this.initPrefix('click', ['click']);
            this.initPrefix('hover', ['mouseover', 'mouseout']);
            this.initPrefix('mouseover', ['mouseover']);
            this.initPrefix('mouseout', ['mouseout']);
            this.initPrefix('input', ['input']);
            this.initPrefix('change', ['change']);
            this.initPrefix('selected', ['click']);
            this.initPrefix('onload', ['onload']);
            this.initPrefix('observe', ['observer']);
            this.initPrefix('resize', ['onload', 'resize']);
            this.initPrefix('localstorage', ['onload', 'observer']);
        }

        let customEventEls = document.querySelectorAll('[event-name]')
        let names = {}
        for (let customEventEl of customEventEls) {
            let name = customEventEl.getAttribute('event-name')
            name = name.split(',')
            for (let i = 0; i < name.length; i++) {
                name[i].trim()
                if (!names[name]) {
                    names[name] = name
                    this.initPrefix(name);
                }
            }
        }

        const self = this
        observer.init({
            name: 'CoCreateEventName',
            observe: ['addedNodes'],
            target: `[event-name]`,
            callback: function (mutation) {
                let name = mutation.target.getAttribute('event-name')
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
                this.__updateElements(data.element, prefix)
            }
        });

        let selector = `[${prefix}], [${prefix}-key], [${prefix}-attribute], [${prefix}-value], [${prefix}-selector], [${prefix}-closest], [${prefix}-parent], [${prefix}-next], [${prefix}-previous]`

        observer.init({
            name: 'CoCreateEventattributes',
            observe: ['attributes', 'addedNodes'],
            attributeName: [`${prefix}-events`],
            target: selector,
            callback: function (mutation) {
                self.initElements([mutation.target], prefix, events)
            }
        });

        if (events && events.includes('observer')) {
            observer.init({
                name: 'observerAttributes',
                observe: ['attributes'],
                attributeName: [`${prefix}-key`, `${prefix}-value`, `${prefix}-selector`, `${prefix}-closest`, `${prefix}-parent`, `${prefix}-next`, `${prefix}-previous`],
                callback: function (mutation) {
                    // remove previous observer
                    self.initElements([mutation.target], prefix, events)
                }
            });
        }

        let elements = document.querySelectorAll(selector)
        this.initElements(elements, prefix, events);
    },

    elements: new Map(),
    initElements: function (elements, prefix, events = []) {
        const self = this
        for (const el of elements) {
            let isEventable = true
            let prefixes = this.elements.get(el)
            if (!prefixes) {
                prefixes = { [prefix]: { events } }
                this.elements.set(el, prefixes)
            } else if (!prefixes[prefix]) {
                prefixes[prefix] = { events }
            } else
                isEventable = false

            let customEvents = el.getAttribute(`${prefix}-events`)
            if (customEvents) {
                customEvents = customEvents.split(',')
                for (let i = 0; i < customEvents.length; i++)
                    customEvents[i] = customEvents[i].trim()

                for (let i = 0; i < events.length; i++)
                    el.removeEventListener(events[i], eventFunction)

                events = customEvents
                prefixes[prefix].events = events
                isEventable = true
            }
            if (!events || !isEventable)
                continue
            if (events.includes('onload'))
                this.__updateElements(el, prefix);

            if (events.includes('observer')) {
                let target;
                for (let attribute of el.attributes) {
                    if (attribute.name === 'observe-target') {
                        target = attribute.value
                        break;
                    } else if ([`${prefix}-selector`, `${prefix}-closest`, `${prefix}-parent`, `${prefix}-next`, `${prefix}-previous`].includes(attribute.name)) {
                        target = attribute.value
                        break;
                    }
                }
                if (target)
                    observer.init({
                        observe: ['addedNodes'],
                        target,
                        callback: function (mutation) {
                            self.__updateElements(el, prefix, mutation.target);
                        }
                    });
            }

            if (events.includes('resize')) {
                const resizeObserver = new ResizeObserver((entries) => {
                    const lastEntry = entries[entries.length - 1];
                    const { width, height } = lastEntry.contentRect;
                    el.setAttribute(`${prefix}-if-value`, width + 'px')
                    self.__updateElements(el, prefix)
                });
                resizeObserver.observe(el);
            }

            for (let i = 0; i < events.length; i++) {
                if (events[i] !== 'onload' && events[i] !== 'observer' && events[i] !== 'resize') {
                    el.removeEventListener(events[i], eventFunction)
                    el.addEventListener(events[i], eventFunction);
                }
            }

            function eventFunction(event) {
                // TODO: apply debounce
                // let debounce;
                // clearTimeout(debounce);
                // debounce = setTimeout(function() {
                const target = event.currentTarget
                if (target) {
                    let prefixes = self.elements.get(target)
                    if (prefixes[prefix].prev === event.type && ['mouseover', 'mouseout'].includes(event.type))
                        return
                    else
                        prefixes[prefix].prev = event.type

                    let attribute = target.getAttribute('actions') || ""
                    if (attribute.includes(prefix))
                        return;
                    // if (target.closest(`[actions*="${prefix}"]`)) 
                    // 	return;
                    self.__updateElements(target, prefix, null, prefixes[prefix].events);

                    // let selector = `[${prefix}], [${prefix}-key], [${prefix}-value], [${prefix}-selector], [${prefix}-closest], [${prefix}-parent], [${prefix}-next], [${prefix}-previous]`

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

    __updateElements: async function (el, prefix, target, events) {
        const self = this;
        let elements = [el]
        let targetGroup = el.getAttribute(`${prefix}-group`);
        if (targetGroup) {
            document.querySelectorAll(`[${prefix}-group="${targetGroup}"]`).forEach((element) => {
                if (element !== el)
                    elements.push(element)
            })
        }

        for (let element of elements) {
            // TODO: support empty value when prefix-attribute defined, add and remove the attribute
            let targetAttribute = element.getAttribute(`${prefix}-attribute`);
            let targetPosition = element.getAttribute(`${prefix}-insert-adjacent`);
            // targetAttribute = checkMediaQueries(targetAttribute)
            // if (targetAttribute === false)
            //     return

            let onEvent = element.getAttribute(`${prefix}-on`)
            if (onEvent) {
                await new Promise((resolve, reject) => {
                    const handleEvent = () => {
                        document.removeEventListener(onEvent, handleEvent);
                        resolve();
                    };
                    document.addEventListener(onEvent, handleEvent);
                });
            }

            let values
            if (prefix === 'localstorage') {
                let key = element.getAttribute('localstorage-get')
                if (key) {
                    values = localStorage.getItem(key)
                } else if (key = element.getAttribute('localstorage-set')) {
                    values = await element.getValue()
                    if (values)
                        localStorage.setItem(key, values)
                }

                // if (!key || !values)
                if (!key)
                    return
            } else {

                values = element.getAttribute(`${prefix}-value`)

                if (values === null) {
                    let valueElements = queryElements({ element, prefix: `${prefix}-value` });
                    if (valueElements) {
                        let elementValues = []
                        for (let i = 0; i < valueElements.length; i++)
                            elementValues.push(valueElements[i].getValue())

                        if (elementValues.length)
                            values = elementValues
                    }
                }

                if (values === null)
                    values = element.getAttribute(`${prefix}-if-value`)
                if (values === null)
                    values = element.getAttribute(prefix);

            }

            if (values || values === '') {
                if (typeof values === 'string')
                    values = values.split(',');
                else if (!Array.isArray(values))
                    values = [values]
            } else {
                values = await element.getValue()
                if (!Array.isArray(values))
                    values = [values]
            }

            if (targetAttribute && !values || values.length === 0)
                return;

            let ifCondition = element.getAttribute(`${prefix}-if`);
            let elseCondition = element.getAttribute(`${prefix}-else`);

            let ifValue = element.getAttribute(`${prefix}-if-value`)
            if (!ifValue && ifValue !== "")
                ifValue = await element.getValue() || values //values // await element.getValue()
            else if (ifValue || ifValue === "")
                ifValue = [ifValue]
            else
                ifValue = values

            if (!Array.isArray(ifValue))
                ifValue = [ifValue]

            //TODO: improved resize toggling of values
            // let hasCondition = this.elements2.get(element)
            if (ifCondition && evaluateCondition(ifCondition, ifValue)) {

                // if (hasCondition && hasCondition.condition === ifCondition) {
                //     return
                // } else
                //     this.elements2.set(element, { condition: ifCondition })
            } else if (elseCondition && evaluateCondition(elseCondition, ifValue)) {
                // if (hasCondition && hasCondition.condition === elseCondition) {
                //     return
                // } else
                //     this.elements2.set(element, { condition: elseCondition })
            } else if (ifCondition || elseCondition) {
                return
            }

            let targetText = element.getAttribute(`${prefix}-text`);
            let targetHtml = element.getAttribute(`${prefix}-html`);
            let targetKey = element.getAttribute(`${prefix}-key`);

            if (prefix === 'selected') {
                if (el !== element)
                    element.removeAttribute('selected')
                else
                    element.setAttribute('selected', '')
            }

            let deactivate = false
            if (el !== element)
                deactivate = true
            // values = values.map(x => x.trim());

            values = values.map(x => {
                if (typeof x === 'string')
                    x = x.trim(); // Update x with the trimmed value
                let prop = element.getAttribute(`${prefix}-property`);
                if (prop) {
                    x = `${prop}:${x}`; // Update x with prop if it exists
                }
                return x; // Return the updated x
            });

            let targetElements = queryElements({ element, prefix });
            if (targetElements === false)
                targetElements = [element]
            let action = element.getAttribute(`${prefix}-action`)
            for (let i = 0; i < targetElements.length; i++) {
                if (action) {
                    targetElements[i][action]()
                } else if (!targetAttribute && targetAttribute !== '' && ['click', 'focus', 'blur'].includes(prefix)) {
                    targetElements[i][prefix]()
                } else {
                    this.setValue(prefix, targetElements[i], targetAttribute, values, targetKey, deactivate, events, targetPosition)
                }
            }
        }

        document.dispatchEvent(new CustomEvent(`${prefix}End`, {
            detail: {}
        }))

    },

    setValue: async function (prefix, element, attrName, values, key, deactivate, events, targetPosition) {
        if (events && events.includes('mouseout')) {
            if (element.matches(':hover')) {
                element.addEventListener('mouseout', () => {
                    this.setValue(prefix, element, attrName, values, key, deactivate, events, targetPosition);
                }, { once: true });
                return;
            }
        }

        let attrValues, oldValue;
        if (key) {
            key = `{{${key}}}`;
            // let value = values[0]
            replaceKey(prefix, element, key, values)
        } else {
            if (attrName === 'style') {
                if (element.getAttribute(attrName)) {
                    attrValues = element.getAttribute(attrName).split(';').map(x => x.trim());
                    attrValues = attrValues.map(function (item, index) {
                        return item.replace(' ', '');
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
                    oldValue = await element.getValue()
                } else if (attrName === 'text' || attrName === 'html' || element.getAttribute(attrName)) {
                    attrValues = element.getAttribute(attrName).split(' ').map(x => x.trim());
                    oldValue = values.filter(x => attrValues.includes(x))[0] || '';
                }

                let newValue = this.__getNextValue(values, oldValue);
                if (deactivate)
                    newValue = ""
                if (attrName === 'class') {
                    if (oldValue) {
                        element.classList.remove(oldValue);
                        if (values.length === 1) {
                            return;
                        }
                    }

                    if (newValue) {
                        element.classList.add(newValue);
                    }
                } else if (attrName === 'value') {
                    element.setValue(newValue);
                } else if (['$click', '$focus', '$blur', '$save', '$read'].includes(attrName)) {
                    element[attrName.substring(1)]()
                } else if (attrName) {
                    // TODO: removeAttribute vs setting empty value, how best to define. operator $remove ???
                    if (newValue === '' && element.hasAttribute(attrName))
                        element.removeAttribute(attrName);
                    else
                        element.setAttribute(attrName, newValue);
                } else if (targetPosition) {
                    if (targetPosition === 'replace') {
                        element.insertAdjacentHTML('beforebegin', newValue); // Insert before oldElement
                        element.remove(); // Remove oldElement
                    } else
                        element.insertAdjacentHTML(targetPosition, newValue);
                } else {
                    if (!attrName && ['click', 'focus', 'blur'].includes(newValue)) {
                        element[newValue]()
                    } else if (['click', 'focus', 'blur'].includes(attrName)) {
                        element[attrName]()
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
    let currentValue = key

    if (eventElements.has(element)) {
        currentValue = eventElements.get(element).get(key);
    }
    let value = CoCreateEvents.__getNextValue(values, currentValue);
    eventKeys.set(key, value)
    eventElements.set(element, eventKeys)

    let attributes = elementAttributes.get(element)
    if (!attributes) {
        attributes = {}
        elementAttributes.set(element, attributes)
    }


    for (let attribute of element.attributes) {
        let newName = attribute.name;
        let newValue = attribute.value;
        let attrName = attribute.name;
        let attrValue = attribute.value;
        let setAttr = false;

        if (attrName === 'clone-data')
            console.log('clone-data')
        if (attrValue.includes(currentValue) || attributes[attrName] && attributes[attrName].valueKeys && attributes[attrName].valueKeys[key]) {
            if (!attributes[attrName])
                attributes[attrName] = { originalValue: attrValue }
            else if (!attributes[attrName].originalValue)
                attributes[attrName].originalValue = attrValue
            if (!attributes[attrName].valueKeys)
                attributes[attrName].valueKeys = { [key]: value }
            else
                attributes[attrName].valueKeys[key] = value;

            newValue = attributes[attrName].originalValue
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
        if (setAttr)
            element.setAttribute(newName, newValue);
    }
    let html = element.innerHTML;
    if (html.indexOf(currentValue) !== -1 || element.htmlKeys && element.htmlKeys[key]) {
        if (!element.originalHtml)
            element.originalHtml = html
        if (!element.htmlKeys)
            element.htmlKeys = { [key]: value }
        else
            element.htmlKeys[key] = value;

        let newHTML = element.originalHtml
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
        return orConditions.some(cond => checkCondition(cond, values));
    } else {
        let andConditions = condition.split(/\s*&&\s*/);
        return andConditions.every(cond => checkCondition(cond, values));
    }
}

function checkCondition(condition, value) {
    let isNegated = condition.startsWith('!');
    if (isNegated) {
        condition = condition.substring(1);
    }
    const operatorMatch = condition.match(/(<=|>=|<|>)(.+)/);
    if (operatorMatch)
        condition = operatorMatch[2].trim()

    let parse = true
    if (condition === 'true') {
        return !!value[0];
    } else if (condition === 'false') {
        return !value[0];
    } else if (condition === '[]' && typeof value[0] === 'string') {
        parse = false
    }



    // TODO: why parse updated conditin to boolean false
    if (parse && condition !== 'false')
        condition = parseCondition(condition);

    let result;

    if (condition === '$template') {
        result = (/{{\s*([\w\W]+)\s*}}/g.test(value[0]))
    } else if (Array.isArray(value) && !(typeof condition === 'object')) {
        if (operatorMatch) {
            condition = parseFloat(condition)
            result = value.some(v => {
                v = parseFloat(v)
                switch (operatorMatch[1]) {
                    case '<': return v < condition;
                    case '>': return v > condition;
                    case '<=': return v <= condition;
                    case '>=': return v >= condition;
                    default: return false;
                }
            });
        } else
            result = value.includes(condition);
    } else if (Array.isArray(value)) {
        // TODO: handle comparing array to array, vs querying the ayya items for a match
        result = queryData(value, condition)
    } else if (typeof value === 'object' && value !== null && typeof parsedCond === 'object') {
        result = queryData(value, condition)
    } else {
        result = value === condition;
    }

    result = isNegated ? !result : result;
    return result

}

function parseCondition(condition) {
    try {
        // Attempt to parse the condition as JSON
        let parsedJson = JSON.parse(condition);
        return parsedJson;
    } catch (e) {
        // If JSON parsing fails, check if the condition is a number
        return !isNaN(condition) && condition.trim() !== '' ? Number(condition) : condition;
    }
}

CoCreateEvents.init();

export default CoCreateEvents;