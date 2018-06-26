const fs = require('fs');
const steam = require('./steam');
const users = require('./users');
const async = require('async');

exports.createFile = (type, callback) => {
	if(type != "random" && type != "unique")
		return callback("Invalid type, must be either random or unique");

	let file = 'data/games/' + type + '.json';

	if(fs.existsSync(file))
		return callback("The file for " + type + " games is already created.");

	let stream = fs.createWriteStream(file);

	let json = {
		"price": {
			"csgo": -1,
			"tf": -1,
			"gems": -1
		}
	}

	switch(type) {
		case "random":
			json.keys = [];
			break;
		case "unique":
			json.keys = {};
			break;
	}

	stream.write(JSON.stringify(json), 'utf8', () => {
		stream.end(() =>
			callback()
		);
	});

	stream.on('error', (error) =>
		callback(error)
	);
}

exports.setRandomPrice = (price, currency, callback) => {
	let file = 'data/games/random.json';

	if(!fs.existsSync(file)) {
		exports.createFile("random", error =>
			exports.setRandomPrice(price, currency, callback)
		);
		return;
	}
	
	if(price.indexOf(":") < 0)
		return callback("Format for price must be price:games (i.e. 1:20 means 20 games will cost 1 key).");

	let bits = price.split(":");
	price = bits[0];
	let games = bits[1];

	if(isNaN(price))
		return callback("Price must be a number.");

	if(isNaN(games))
		return callback("Game amount must be a number.");

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		setRandomPrice(price, games, currency, json, callback);
	});
}

const setRandomPrice = (price, games, currency, json, callback) => {
	let file = 'data/games/random.json';

	switch(currency) {
		case "csgo":
			json.price.csgo = {
				'price': price,
				'games': games
			};
			break;
		case "tf":
			json.price.tf = {
				'price': price,
				'games': games
			};
			break;
		case "gems":
			json.price.gems = {
				'price': price,
				'games': games
			};
			break;
		default:
			return callback("Invalid currency, must be one of CSGO/TF/GEMS");
	}

	let stream = fs.createWriteStream(file);

	stream.write(JSON.stringify(json), () => {
		stream.end(() => {
			users.updatePersona();
			callback();
		}
		);
	});

	stream.on('error', (error) =>
		callback(error)
	);
}

exports.getRandomPrice = (callback) => {
	let file = 'data/games/random.json';

	if(!fs.existsSync(file))
		return callback(null, -1);

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		callback(null, json.price, json.keys.length);
	});
}

exports.getPrice = (callback) => {
	let file = 'data/games/unique.json';

	if(!fs.existsSync(file)) {
		return callback("No prices set.");
	}

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		let prices = [];

		if(json.price.csgo && json.price.csgo != -1)
			prices.push("CSGO: " + json.price.csgo.price + ":" +  json.price.csgo.games);

		if(json.price.tf && json.price.tf != -1)
			prices.push("TF: " + json.price.tf.price + ":" +  json.price.tf.games);

		if(json.price.gems && json.price.gems != -1)
			prices.push("Gems: " + json.price.gems.price + ":" +  json.price.gems.games);

		let unique = prices.join("\n - ");

		file = 'data/games/random.json';

		if(!fs.existsSync(file)) {
			return callback("No prices set");
		}

		read = fs.createReadStream(file, 'utf8');
		data = "";

		read.on('data', chunk =>
			data += chunk
		);

		read.on('end', () => {
			try {
				json = JSON.parse(data);
			} catch(error) {
				return callback(error);
			}

			prices = [];

			if(json.price.csgo && json.price.csgo != -1)
				prices.push("CSGO: " + json.price.csgo.price + ":" +  json.price.csgo.games);

			if(json.price.tf && json.price.tf != -1)
				prices.push("TF: " + json.price.tf.price + ":" +  json.price.tf.games);

			if(json.price.gems && json.price.gems != -1)
				prices.push("Gems: " + json.price.gems.price + ":" +  json.price.gems.games);

			let random = prices.join("\n - ");

			callback(null, random, unique);
		});
	});
}

exports.getUniqueCount = (callback) => {
	 let file = 'data/games/unique.json';

	if(!fs.existsSync(file))
		return callback(null, -1);

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		let count = 0;
		for(let game in json.keys) {
			if(json.keys.hasOwnProperty(game)) {
				count += json.keys[game].length;
			}
		}

		callback(null, count);
	});
}

exports.setPrice = (price, currency, callback) => {
	let file = 'data/games/unique.json';

	if(!fs.existsSync(file)) {
		exports.createFile("unique", error =>
			exports.setPrice(price, currency, callback)
		);
		return;
	}

	if(price.indexOf(":") < 0)
		return callback("Format for price must be price:games (i.e. 1:20 means 20 games will cost 1 key).");

	let bits = price.split(":");
	price = bits[0];
	let games = bits[1];

	if(isNaN(price))
		return callback("Price must be a number.");

	if(isNaN(games))
		return callback("Game amount must be a number.");

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		setPrice(price, games, currency, json, callback);
	});
}

const setPrice = (price, games, currency, json, callback) => {
	let file = 'data/games/unique.json';

	switch(currency) {
		case "csgo":
			json.price.csgo = {
				'price': price,
				'games': games
			};
			break;
		case "tf":
			json.price.tf = {
				'price': price,
				'games': games
			};
			break;
		case "gems":
			json.price.gems = {
				'price': price,
				'games': games
			};
			break;
		default:
			return callback("Invalid currency, must be one of CSGO/TF/GEMS");
	}

	let stream = fs.createWriteStream(file);

	stream.write(JSON.stringify(json), () => {
		stream.end(() => {
			users.updatePersona();
			callback();
		}
		);
	});

	stream.on('error', (error) =>
		callback(error)
	);
}

exports.getUnique = (callback) => {
	let file = 'data/games/unique.json';

	if(!fs.existsSync(file)) {
		exports.createFile("unique", error =>
			exports.getUnique(callback)
		);
		return;
	}

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		getUnique(json, callback);
	});
}

const getUnique = (json, callback) => {
	let price = json.price;
	let keys = json.keys;

	let games = [];

	for(let game in keys) {
		if(keys.hasOwnProperty(game)) {
			if(keys[game].length <= 0)
				continue;

			if(games.indexOf(game) < 0) {
				let appid = steam.getAppID(game);
				if(!isNaN(appid))
					games.push(appid);
			}
		}
	}

	callback(null, {games: games, prices: price});
}

exports.addKey = (key, game, callback) => {
	let file = 'data/games/unique.json';

	if(!fs.existsSync(file)) {
		exports.createFile("unique", error => {
			if(error)
				return callback(error);

			exports.addKey(key, game, callback);
		});

		return;
	}

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(!json.keys[game])
			json.keys[game] = [];

		if(json.keys[game].indexOf(key) >= 0)
			return callback("Duplicate key.");

		json.keys[game].push(key);

		let stream = fs.createWriteStream(file);

		stream.write(JSON.stringify(json), () => {
			stream.end(() => {
				users.updatePersona();
				callback()
			}
			);
		});

		stream.on('error', (error) =>
			callback(error)
		);
	});
}

exports.addRandomKey = (key, callback) => {
	let file = 'data/games/random.json';

	if(!fs.existsSync(file)) {
		exports.createFile("random", error => {
			if(error)
				return callback(error);

			exports.addRandomKey(key, callback);
		});
		return;
	}

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(json.keys.indexOf(key) >= 0)
			return callback("Duplicate key.");

		json.keys.push(key);
		
		let stream = fs.createWriteStream(file);

		stream.write(JSON.stringify(json), () => {
			stream.end(() => {
				callback();
				users.updatePersona();
			}
			);
		});

		stream.on('error', (error) =>
			callback(error)
		);
	});
}

exports.removeKey = (game, key, callback) => {
	let file = 'data/games/unique.json';

	if(!fs.existsSync(file))
		return callback("No keys have been added yet.");

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(!json.keys[game])
			return callback("Encountered an unexpected error, please try again in a bit.");

		if(json.keys[game].indexOf(key) < 0)
			return callback("Encountered an unexpected error, please try again in a bit.");

		json.keys[game].splice(json.keys[game].indexOf(key), 1);

		let stream = fs.createWriteStream(file);

		stream.write(JSON.stringify(json), () => {
			stream.end(() => {
				users.updatePersona();
				callback();
			}
			);
		});

		stream.on('error', (error) =>
			callback(error)
		);
	});
}

exports.removeRandomKey = (key, callback) => {
	let file = 'data/games/random.json';

	if(!fs.existsSync(file))
		return callback("No keys have been added yet.");

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(json.keys.indexOf(key) < 0)
			return callback("Encountered an unexpected error, please try again in a bit.");

		json.keys.splice(json.keys.indexOf(key), 1);
		
		let stream = fs.createWriteStream(file);

		stream.write(JSON.stringify(json), () => {
			stream.end(() => {
				users.updatePersona();
				callback();
			}
			);
		});

		stream.on('error', (error) =>
			callback(error)
		);
	});
}

exports.loadFromFile = (file, callback) => {
	if(!fs.existsSync(file))
		return callback("File does not exist");

	let read = fs.createReadStream(file, 'utf8');
	let data = "";

	read.on('data', chunk =>
		data += chunk
	);

	read.on('end', () => {
		let lines = data.split("\n");

		load(lines, callback);
	});

	read.on('error', error =>
		callback(error)
	);
}

const load = (lines, callback) => {
	let calls = [];

	lines.forEach(line => {
		if(line.match(/.+\s\|\s.+/) == null) {
			let func = callback => {
				exports.addRandomKey(line.trim(), error => {
					if(error == "Duplicate key.")
						error = null;

					callback(error);
				});
			}

			return calls.push(func);
		}

		let bits = line.split(/\s\|\s/);

		let game = bits[0].trim();
		let key = bits[1].trim();

		let func = callback => {
			exports.addKey(key, game, error => {
				if(error == "Duplicate key.")
					error = null;
				
				callback(error);
			});
		}

		calls.push(func);
	});

	async.series(calls, error => {
		if(error)
			return callback(error);

		callback();
	});
}