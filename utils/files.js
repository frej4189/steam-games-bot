const fs = require('fs');
const steam = require('./steam');

var config = {};
var apps = null;

exports.setup = callback => {
	let read = fs.createReadStream('data/config.json');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		try {
			config = JSON.parse(data);
		} catch(error) {
			console.error("An error occurred: " + error);
			process.exit();
			return;
		}

		exports.updateApps(callback);
	});
}

exports.updateApps = (callback) => {
	steam.getApps((error, appList) => {
		if(error) {
			callback(error);
			return;
		}

		let updatedApps = [];

		if(apps != null) {
			updatedApps = getKeyDiff(apps, appList);
		}

		apps = appList;

		fs.writeFile('data/apps.json', JSON.stringify(appList), (error) => {
			if(error) {
				callback(error);
				return;
			}

			callback(null, updatedApps.length);
		});
	});
}

const getKeyDiff = (oldObj, newObj) => {
	let keys = [];

	for(let app in newObj) {
		if(newObj[app])
			keys.push(app);
	}

	for(let app in oldObj) {
		if(oldObj[app]) {
			if(keys.indexOf(app) >= 0)
				keys.splice(keys.indexOf(app), 1);
		}
	}

	return keys;
}

exports.getConfig = () => {
	return config;
}

exports.getApps = () => {
	return apps;
}
