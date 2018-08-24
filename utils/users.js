const steam = require('./steam');
const games = require('./games');
const offers = require('./offers');
const fs = require('fs');
const async = require('async');
const commands = require('./commands');

let currentRead = null;
let currentData = null;

exports.updatePersona = () => {
	games.getRandomPrice((error, price, rgames) => {
		if(error)
			return console.error("Error while updating status: " + error);

		games.getUniqueCount((error, games) => {
			if(error)
				return console.error("Error while updating status: " + error);

			let csgo = "0:1";
			if(price.csgo.price && price.csgo.games)
				csgo = price.csgo.games + ":" + price.csgo.price;

			let tf = "0:1";
			if(price.tf.price && price.tf.games)
				tf = price.tf.games + ":" + price.tf.price;

			let gems = "0:1";
			if(price.gems.price && price.gems.games)
				gems = price.gems.games + ":" + price.gems.price

			steam.updatePersona(rgames + games, csgo, tf, gems);
		});
	});
}

exports.performBuyCheck = (user, callback) => {
	games.getUnique((error, unique) => {
		if(error)
			return callback(error);

		offers.getOwnedGames(user, (error, owned) => {
			if(error)
				return callback(error);

			let diff = [];
			let gamelist = unique.games;

			gamelist.forEach(game => {
				if(owned.indexOf(game) < 0)
					diff.push(game);
			});

			let csgo = unique.prices.csgo < 0 ? -1 : (diff.length / unique.prices.csgo.games) * unique.prices.csgo.price;
			let tf = unique.prices.tf < 0 ? -1 : (diff.length / unique.prices.tf.games) * unique.prices.tf.price;
			let gems = unique.prices.gems < 0 ? -1 : (diff.length / unique.prices.gems.games) * unique.prices.gems.price;

			csgo = csgo.toFixed(2);
			tf = tf.toFixed(2);
			gems = gems.toFixed(2);

			let price = (csgo >= 0 ? csgo + " CSGO keys. " : "") + (tf >= 0 ? tf + " TF keys. " : "") + (gems >= 0 ? gems + " Gems. " : "");

			if(price.length == 0)
				price = "but prices are not yet set, so you cannot buy any.";
			else
				price = "it will cost you " + price;

			let uniq = [];

			uniq.push(diff.length);
			uniq.push(price);

			games.getRandomPrice((error, rprice, games) => {
				if(error)
					return callback(error);

				let csgo = "";
				if(rprice.csgo.price && rprice.csgo.games)
					csgo = rprice.csgo.price + ":" + rprice.csgo.games

				let tf = "";
				if(rprice.tf.price && rprice.tf.games)
					tf = rprice.tf.price + ":" + rprice.tf.games;

				let gems = "";
				if(rprice.gems.price && rprice.gems.games)
					gems = rprice.gems.price + ":" + rprice.gems.games

				let price = (csgo.length > 0 ? csgo + " (CSGO). " : "") + (tf.length > 0 ? tf + " (TF). " : "") + (gems.length > 0 ? gems + " (Gems). " : "");
				let random = "There are currently " + games + " random games in stock, price is " + price;

				if(price.length == 0)
					random = "";

				callback(null, random, uniq);
			});
		});
	});
}

exports.buyGame = (sender, amount, payment, callback) => {
	offers.hasOffer(sender, (error, has) => {
		if(error)
			return callback(error);

		if(has)
			return callback("Please react to my outstanding offer with you.");

		if(amount <= 0)
			return callback("Amount must be greater than 0");

		let file = "data/games/unique.json";

		let user = sender;

		if(!fs.existsSync) {
			games.createFile("unique", error => {
				if(error)
					return callback(error);

				buyGame(sender, payment, callback);
			});
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

			games.getUnique((error, unique) => {
				if(error)
					return callback(error);

				offers.getOwnedGames(user, (error, owned) => {
					if(error)
						return callback(error);

					let diff = [];
					let gamelist = unique.games;

					gamelist.forEach(game => {
						if(owned.indexOf(game) < 0)
							diff.push(game);
					});

					if(diff.length <= 0)
						return callback("I don't have any games that you don't already own.");

					createReservation(sender, diff, amount, payment, json, (error, full) => {
						if(error)
							return callback(error);

						buyGame(sender, amount, payment, json, full, callback);
					});
				});
			});
		});
	});
}

exports.buyRandom = (sender, amount, payment, callback) => {
	offers.hasOffer(sender, (error, has) => {
		if(error)
			return callback(error);

		if(has)
			return callback("Please react to my outstanding offer with you.");

		if(amount <= 0)
			return callback("Amount must be greater than 0");

		let read = fs.createReadStream("data/games/random.json", 'utf8');
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

			createRandomReservation(sender, amount, payment, json, (error, full) => {
				if(error)
					return callback(error);

				buyRandomGame(sender, amount, payment, json, full, callback);
			});
		});
	});
}

const buyGame = (sender, amount, payment, json, full, callback) => {
	let price = parseInt(json.price[payment].price * amount);

	if(price < 0)
		return callback("That payment method is not currently available, try again later.");

	offers.createBuyOffer(sender, price, payment, full, callback);
}

const buyRandomGame = (sender, amount, payment, json, full, callback) => {
	let price = parseInt(json.price[payment].price * amount);

	if(price < 0)
		return callback("That payment method is not currently available, try again later.");

	offers.createRandomBuyOffer(sender, price, payment, full, callback);
}

const createRandomReservation = (user, amount, payment, gameObj, callback) => {
	user = user.toString();

	let gamelist = gameObj.price[payment].games * amount;

	if(gamelist == null)
		return callback("That payment method is not currently available, try again later.");

	var full = true;

	if(gameObj.keys.length <= 0)
		return callback("I currently have no random keys in stock.");

	if(gameObj.keys.length < gamelist) {
		gamelist = gameObj.keys.length;
		full = false;
	}

	let read = currentRead == null ? fs.createReadStream('data/reservations.json', 'utf8') : currentRead;
	let data = currentData == null ? "" : currentData;

	currentRead = read;
	currentData = data;

	read.on('data', chunk => {
		data += chunk;
		currentData = data;
	});

	read.on('end', () => {
		currentRead = null;
		currentData = null;
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(json[user])
			delete json[user];

		json[user] = {keys: [], accepted: false};

		let calls = [];

		for(let i = 0; i < gamelist; i++) {
			let key = gameObj.keys[i];

			json[user].keys.push(key);

			let func = callback => {
				games.removeRandomKey(key, error => {
					callback(error);
				});
			};

			calls.push(func);
		}

		async.series(calls, (error, results) => {
			if(error)
				return callback(error);

			let stream = fs.createWriteStream('data/reservations.json');

			stream.write(JSON.stringify(json), () => {
				stream.end(() =>
					callback(null, full)
				);
			});

			stream.on('error', (error) =>
				callback(error)
			);
		});
	});
}

const createReservation = (user, diff, amount, payment, gameObj, callback) => {
	user = user.toString();

	let gamelist = gameObj.price[payment].games * amount;

	if(gamelist == null)
		return callback("That payment method is not currently available, try again later.");

	let translated = [];

	diff.forEach(game => {
		let name = steam.getGameName(game);

		if(gameObj.keys[name] && gameObj.keys[name].length > 0)
			translated.push(name);
	});

	var full = true;

	if(translated.length <= 0)
		return callback("I currently have no keys for games that you don't own in stock.");

	if(translated.length > gamelist) {
		let gameDiff = translated.length - gamelist;
		translated.splice(gamelist - 1, gameDiff);
	} else if(translated.length < gamelist && amount <= 1) {
		full = false;
	} else if(translated.length < gamelist && amount > 1)
		return callback("I don't have enough keys in stock for you to buy " + gamelist + " games, please try a lower amount.");

	let read = currentRead == null ? fs.createReadStream('data/reservations.json', 'utf8') : currentRead;
	let data = currentData == null ? "" : currentData;

	currentRead = read;
	currentData = data;

	read.on('data', chunk => {
		data += chunk;
		currentData = data;
	});

	read.on('end', () => {
		currentRead = null;
		currentData = null;
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(json[user])
			delete json[user];

		json[user] = {keys: [], accepted: false};

		let calls = [];

		translated.forEach(game => {
			let arr = gameObj.keys[game];

			if(arr.length <= 0)
				return;

			let key = arr[0];

			json[user].keys.push({game: game, key: key});

			let func = callback => {
				games.removeKey(game, key, error =>
					callback(error)
				);
			};

			calls.push(func);
		});

		async.series(calls, (error, results) => {
			if(error)
				return callback(error);

			let stream = fs.createWriteStream('data/reservations.json');

			stream.write(JSON.stringify(json), () => {
				stream.end(() => 
					callback(null, full)
				);
			});

			stream.on('error', (error) =>
				callback(error)
			);
		});
	});
}

exports.removeReservation = (user, add, cb) => {
	user = user.toString();
	if(add)
		commands.setWorking(user);

	let callback = (error) => {
		cb(error);
		if(add)
			commands.setNotWorking(user);
	}

	let read = currentRead == null ? fs.createReadStream('data/reservations.json', 'utf8') : currentRead;
	let data = currentData == null ? "" : currentData;

	currentRead = read;
	currentData = data;

	read.on('data', chunk => {
		data += chunk;
		currentData = data;
	});

	read.on('end', () => {
		currentRead = null;
		currentData = null;
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(!json[user])
			return callback("User has no reservations.");

		if(add) {
			let calls = [];

			for(let i = 0; i < json[user].keys.length; i++) {
				let game = json[user].keys[i];

				if(typeof game == 'string') {
					let func = callback => {
						games.addRandomKey(game, error => {
							callback(error);
						});
					}

					calls.push(func);
				} else {
					let func = callback => {
						games.addKey(game.key, game.game, error => {
							callback(error);
						});
					}

					calls.push(func);
				}
			}

			async.series(calls, (error, results) => {
				if(error)
					return callback(error);

				delete json[user];

				let stream = fs.createWriteStream('data/reservations.json');

				stream.write(JSON.stringify(json), () => {
					stream.end(() => {
						offers.cancel(user, () =>
							callback()
						);
					});
				});

				stream.on('error', (error) =>
					callback(error)
				);
			});
			return;
		}

		delete json[user];

		let stream = fs.createWriteStream('data/reservations.json');

		stream.write(JSON.stringify(json), () => {
			stream.end(() =>
				callback()
			);
		});

		stream.on('error', (error) =>
			callback(error)
		);
	});
}

exports.offerAccepted = (user, callback) => {
	user = user.toString();

	let read = currentRead == null ? fs.createReadStream('data/reservations.json', 'utf8') : currentRead;
	let data = currentData == null ? "" : currentData;

	currentRead = read;
	currentData = data;

	read.on('data', chunk => {
		data += chunk;
		currentData = data;
	});

	read.on('end', () => {
		currentRead = null;
		currentData = null;
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(!json[user])
			return callback("User does not have any reservations.");

		json[user].accepted = true;

		let stream = fs.createWriteStream('data/reservations.json');

		stream.write(JSON.stringify(json), () => {
			stream.end(() =>
				callback()
			);
		});

		stream.on('error', error =>
			callback(error)
		)
	});
}

exports.handle = (user, callback) => {
	user = user.toString();

	let read = currentRead == null ? fs.createReadStream('data/reservations.json', 'utf8') : currentRead;
	let data = currentData == null ? "" : currentData;

	currentRead = read;
	currentData = data;

	read.on('data', chunk => {
		data += chunk;
		currentData = data;
	});

	read.on('end', () => {
		currentRead = null;
		currentData = null;
		let json;

		try {
			json = JSON.parse(data);
		} catch(error) {
			return callback(error);
		}

		if(!json[user])
			return callback("You have not bought game yet, use !buy or !buyrandom");

		if(!json[user].accepted) {
			return callback("You must first accept your outstanding offer");
		}

		let keys = json[user].keys;

		let logData = [user + " bought " + keys.length + " games: "];
		let keymsgs = [];

		for(let i = 0; i < keys.length; i++) {
			let game = keys[i];

			if(typeof game == 'string') {
				keymsgs.push(game);
				logData.push(game);
			} else {
				keymsgs.push(game.game + ": " + game.key);
				logData.push(game.game + ": " + game.key);
			}
		}

		steam.message(user, "Thanks for accepting the trade, here are your keys: \n" + keymsgs.join("\n"));

		let logread = fs.createReadStream('data/reservations.json', 'utf8');
		let readdata = "";

		logread.on('data', chunk => 
			readdata += chunk
		)

		logread.on('end', () => {
			if(readdata.indexOf(logData.join("\n")) >= 0)
				return callback();

			let log = fs.createWriteStream('data/log.txt', {flags: 'a'});

			log.write("\n\n\n" + logData.join("\n"), () => {
				log.end(() =>
					callback()
				);
			});
		});
	});
}
