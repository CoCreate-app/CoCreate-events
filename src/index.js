import {queryDocumentSelectorAll} from '@cocreate/utils';

const CoCreateEvents = {
	
	init: function() {
		this.initElement(document, 'events');
		this.initElement(document, 'click');
		this.initElement(document, 'hover');
		this.initElement(document, 'mouseover');
		this.initElement(document, 'mouseout');
		this.initElement(document, 'input');
		this.initElement(document, 'change');
	},
	
	initElement: function(container, prefix) {
		this.__initElementEvent(container || document, prefix);
	},
	
	__initElementEvent: function(mainContainer, prefix) {
		const self = this;
		let eventNames = []; 
		
		if (prefix === 'toggle') eventNames = ['click'];
		if (prefix === 'click') eventNames = ['click'];
		if (prefix === 'hover') eventNames = ['mouseover', 'mouseout'];
		if (prefix === 'mouseover') eventNames = ['mouseover'];
		if (prefix === 'mouseout') eventNames = ['mouseout'];
		if (prefix === 'input') eventNames = ['input'];
		if (prefix === 'change') eventNames = ['change'];
	
		eventNames.forEach((event_name) => {
			mainContainer.addEventListener(event_name, function(event) {
				const target = event.target.closest(`[${prefix}], [${prefix}-value]`);
				if (target) {
					self.__updateElements(target, prefix);
				}
			});
		});
	},
	
	__updateElements: function(element, prefix) {
		const self = this;
		let targetValue = element.getAttribute(`${prefix}-value`) || element.getAttribute(prefix);
		let values = targetValue.split(',');
		if (!values || values.length == 0) {
			return;
		}
		
		let targetAttribute = element.getAttribute(`${prefix}-attribute`) || 'class';
		let targetSelector = element.getAttribute(`${prefix}-target`);
		let targetClosest = element.getAttribute(`${prefix}-closest`);
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

				// el.removeAttribute(prefix)
				self.setValue(el, groupAttribute, groupValue, 'deactivate')
				if (groupTarget)
					document.querySelectorAll(groupTarget).forEach((el) => 
						self.setValue(el, groupAttribute, groupValue, 'deactivate')
					);
				else if (groupClosest) {
					let element = el.closest(groupClosest)
					if (element)
						self.setValue(element, groupAttribute, groupValue, 'deactivate');
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
			targetElements.forEach((el) => self.setValue(el, targetAttribute, values));
		} else
			self.setValue(element, targetAttribute, values);
	},
	
	setValue: function(element, attrName, values, deactivate) {
		let attrValues, oldValue;
	
		if (attrName === 'style') {
			if (element.getAttribute(attrName)) {
				attrValues = element.getAttribute(attrName).split(';').map(x => x.trim());
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
				let [property, value] = newValue.split(":");
				element.style[property] = value;
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

CoCreateEvents.init();

export default CoCreateEvents;