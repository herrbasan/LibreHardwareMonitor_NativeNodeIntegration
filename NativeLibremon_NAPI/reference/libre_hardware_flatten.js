'use strict';

// Utility function to convert text to slug format
function slugify(text) {
	return text.toString().toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^\w\-]+/g, '')
		.replace(/\-\-+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

function flatten(data) {
	if (!data || !data.Children || !data.Children[0] || !data.Children[0].Children) {
		return false;
	}

	let out = {};
	data = data.Children[0].Children;
	
	for (let i = 0; i < data.length; i++) {
		let type = getType(data[i].ImageURL);
		if (type == 'mainboard') {
			if (data[i].Children.length > 0) {
				data[i].Children = data[i].Children[0].Children;
			}
		}
		if (!out[type]) { out[type] = [] };
		let group = getGroup(data[i].Children, type, out[type].length);
		group.name = data[i].Text;
		group.id = data[i].id;
		out[type].push(group);
	}
	
	return out;
}

function getGroup(obj, hw_type, idx) {
	let out = {};
	for (let i = 0; i < obj.length; i++) {
		let type = slugify(obj[i].Text);
		let sensors = getSensors(obj[i].Children, hw_type, idx);
		sensors.name = obj[i].Text;
		sensors.id = obj[i].SensorId;
		if (!out[type]) { out[type] = sensors };
	}
	return out;
}

function getSensors(obj, hw_type, idx) {
	let out = {};
	for (let i = 0; i < obj.length; i++) {
		let type = slugify(obj[i].Text);
		let values = getValues(obj[i], hw_type, idx);
		if (!out[type]) { out[type] = values }
	}
	return out;
}

function getValues(obj, hw_type, idx) {
	if (obj.Children.length == 0) { delete obj.Children; }
	if (obj.ImageURL) { delete obj.ImageURL; }
	if (obj.Text) {
		obj.name = obj.Text;
		delete obj.Text;
	}
	obj.data = {};
	if (obj.Type) { delete obj.Type; }
	if (obj.id) { delete obj.id; }

	if (obj.Value) { obj.data = parseValue(obj.Value); delete obj.Value; }
	if (obj.Max) { obj.data.max = parseValue(obj.Max).value; delete obj.Max; }
	if (obj.Min) { obj.data.min = parseValue(obj.Min).value; delete obj.Min; }
	return obj;
}

function getType(s) {
	let type = s.split('/')[1].split('.')[0];
	if (type == 'nvidia' || type == 'ati' || type == 'intel') {
		type = 'gpu';
	}
	return slugify(type);
}

function parseValue(item) {
	let split = item.split(' ');
	let type = split[1];
	let num = split[0].replace(/,/g, '.');
	num = parseFloat(num);
	return { value: num, type: type };
}

module.exports.flatten = flatten;
