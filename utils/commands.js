const games = require('./games');
const offers = require('./offers');
const steam = require('./steam');
const files = require('./files');
const users = require('./users');

let tasks = [];
let current = [];

exports.setWorking = (user) => {current.push(user)};
exports.setNotWorking = (user) => {current.splice(current.indexOf(user), 1)}

exports.execute = (sender, command, args) => {
	if(current.indexOf(sender.getSteamID64()) > -1)
		return steam.message(sender, "Please wait for your current action to be completed.");

	let cmdObj = commands[command];

	if(cmdObj == null)
		return steam.message(sender, command + " is not a valid command.");

	if(cmdObj.admin && files.getConfig().admins.indexOf(sender.toString()) < 0)
		return steam.message(sender, command + " is not a valid command.");
	
	if(!cmdObj.args && !cmdObj.optional)
		return cmdObj.exec(sender);

	if(cmdObj.args && cmdObj.args.length > args.length) {
		if(command.toLowerCase().startsWith("buy"))
			return steam.message(sender, "You must enter a valid amount.");

		return steam.message(sender, "Invalid arguments.");
	}

	cmdObj.exec(sender, args);
}

const updateapps = (sender) => {
	files.updateApps((error, updated) => {
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, additional information in console.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "Apps were updated, " + (updated < 0 ? " removed " + updated * - 1 : " added " + updated) + ".");
	});
}

const load = (sender, args) => {
	let file = args[0];

	games.loadFromFile('data/load/' + file, error => {
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, additional information in console - any scans preceding the error has succeeded.");
			}

			return steam.message(sender, error + " - any scans preceding the error has succeeded.");
		}

		steam.message(sender, "Succesfully loaded all games from " + file + ".");
	});
}

const setprice = (sender, args) => {
	let price = args[0];
	let currency = args[1];
	let type = args[2].toLowerCase();

	if(type == "random") {
		games.setRandomPrice(price, currency, error => {
			if(error) {
				if(typeof error != 'string') {
					console.error(error);
					return steam.message(sender, "An error occurred, additional information in console.");
				}

				return steam.message(sender, error);
			}

			steam.message(sender, "Set price of random games to " + price + " " + currency + ".");
		});
		return;
	}

	if(type == "unique") {
		games.setPrice(price, currency, error => {
			if(error) {
				if(typeof error != 'string') {
					console.error(error);
					return steam.message(sender, "An error occurred, additional information in console.");
				}

				return steam.message(error);
			}

			steam.message(sender, "Set price of unqiue games to " + price + " " + currency + ".");
		});
		return;
	}

	steam.message(sender, "Invalid type, must be either random or unique");
}

const broadcast = (sender, args) => {
	let message = args.join(" ");
	
	steam.broadcast(message);
}

const withdraw = (sender) => {
	let index = current.push(sender.getSteamID64()) - 1;
	offers.withdraw(sender, (error, offer) => {
		current.splice(index, 1);
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, additional information in console.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "Offer sent: " + offer);
	});
}

const help = (sender) => {
	for(let command in commands) {
		if(!commands.hasOwnProperty(command))
			continue;

		if(commands[command].admin && files.getConfig().admins.indexOf(sender.toString()) < 0)
			continue;

		let admin = commands[command].admin ? "[ADMIN ONLY] " : "";
		let args = commands[command].hasOwnProperty('args') ? " <" + commands[command].args.join("> <") + ">" : "";
		let optional = commands[command].hasOwnProperty('optional') ? " [" + commands[command].optional.join("] [") + "] " : "";
		let description = " - " + commands[command].description;
		command = "!" + command;

		steam.message(sender, admin + command + args + optional + description);
	}

	steam.message(sender, "For commands that take payment as an argument, it must be one of CSGO/TF/GEMS");
}

const check = (sender, args) => {
	users.performBuyCheck(sender, (error, random, unique) => {
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "I have " + unique[0] + " games that you don't own, " + unique[1]);

		if(random.length > 0)
			steam.message(sender, random);
	});
}

const owner = (sender) => {
	steam.message(sender, files.getConfig().owner);
}

const price = (sender) => {
	games.getPrice((error, random, unique) => {
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		if(unique.length > 0)
			steam.message(sender, "Prices for unique games are\n - " + unique);

		if(random.length > 0)
			steam.message(sender, "Prices for ´random games are\n - " + random);
	});
}

const buy = (sender, args) => {
	let amount = 1;

	if(args.length >= 1 && isNaN(args[0]))
		return steam.message(sender, "Invalid amount");

	if(args.length >= 1)
		amount = parseInt(args[0]);

	let index = current.push(sender.getSteamID64()) - 1;

	users.buyGame(sender.toString(), amount, "csgo", (error, offer) => {
		current.splice(index, 1);
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "(REMEMBER TO READ OFFER MESSAGE) Offer sent: " + offer);
	});
}

const buytf = (sender, args) => {
	let amount = 1;

	if(args.length >= 1 && isNaN(args[0]))
		return steam.message(sender, "Invalid amount");

	if(args.length >= 1)
		amount = parseInt(args[0]);

	let index = current.push(sender.getSteamID64()) - 1;

	users.buyGame(sender.toString(), amount, "tf", (error, offer) => {
		current.splice(index, 1);
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "(REMEMBER TO READ OFFER MESSAGE) Offer sent: " + offer);
	});
}

const buygems = (sender, args) => {
	let amount = 1;

	if(args.length >= 1 && isNaN(args[0]))
		return steam.message(sender, "Invalid amount");

	if(args.length >= 1)
		amount = parseInt(args[0]);

	let index = current.push(sender.getSteamID64()) - 1;

	users.buyGame(sender.toString(), amount, "gems", (error, offer) => {
		current.splice(index, 1);
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "(REMEMBER TO READ OFFER MESSAGE) Offer sent: " + offer);
	});
}

const buyrandom = (sender, args) => {
	let amount = 1;
	if(args.length >= 1 && isNaN(args[0]))
		return steam.message(sender, "Invalid amount");

	if(args.length >= 1)
		amount = parseInt(args[0]);

	let index = current.push(sender.getSteamID64()) - 1;

	users.buyRandom(sender.toString(), amount, "csgo", (error, offer) => {
		current.splice(index, 1);
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "(REMEMBER TO READ OFFER MESSAGE) Offer sent: " + offer);
	});
}

const buyrandomtf = (sender, args) => {
	let amount = 1;
	if(args.length >= 1 && isNaN(args[0]))
		return steam.message(sender, "Invalid amount");

	if(args.length >= 1)
		amount = parseInt(args[0]);

	let index = current.push(sender.getSteamID64()) - 1;

	users.buyRandom(sender.toString(), amount, "tf", (error, offer) => {
		current.splice(index, 1);
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "(REMEMBER TO READ OFFER MESSAGE) Offer sent: " + offer);
	});
}

const buyrandomgems = (sender, args) => {
	let amount = 1;
	if(args.length >= 1 && isNaN(args[0]))
		return steam.message(sender, "Invalid amount");

	if(args.length >= 1)
		amount = parseInt(args[0]);

	let index = current.push(sender.getSteamID64()) - 1;

	users.buyRandom(sender.toString(), amount, "gems", (error, offer) => {
		current.splice(index, 1);
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}

		steam.message(sender, "(REMEMBER TO READ OFFER MESSAGE) Offer sent: " + offer);
	});
}

const retrieve = (sender) => {
	users.handle(sender, (error) => {
		if(error) {
			if(typeof error != 'string') {
				console.error(error);
				return steam.message(sender, "An error occurred, please try again later.");
			}

			return steam.message(sender, error);
		}
	});
}

const cancel = (sender) => {
	offers.cancel(sender, () => {
		steam.message(sender, "Your offer has been cancelled.");
	});
}

const commands = {
	updateapps: {
		description: 'Updates the apps.json file, containing information about steam games (necessary for unique games).',
		admin: true,
		exec: updateapps
	},
	load: {
		args: ['file'],
		description: 'Loads in games from the load folder, file specified is the file name, not full path.',
		admin: true,
		exec: load
	},
	broadcast: {
		args: ['message'],
		description: 'Sends a message to all of the bots friends.',
		admin: true,
		exec: broadcast
	},
	setprice: {
		args: ['price', 'payment', 'random/unique'],
		description: 'Sets the price of either random or unique games. Format for price is price:games (i.e. 1:20 means 20 games will cost 1 key).',
		admin: true,
		exec: setprice
	},
	withdraw: {
		description: 'Sends you an offer with all of my items.',
		admin: true,
		exec: withdraw
	},
	help: {
		description: 'Displays a list of available commands.',
		admin: false,
		exec: help
	},
	owner: {
		description: 'Tells you who owns this bot.',
		admin: false,
		exec: owner
	},
	price: {
		description: 'Displays my prices.',
		admin: false,
		exec: price
	},
	check: {
		description: "Tells you how many games you can buy from me, and for what price.",
		admin: false,
		exec: check
	},
	buy: {
		args: ['amount'],
		description: "Sends you an offer with the CSGO price of the unique games.",
		admin: false,
		exec: buy
	},
	buytf: {
		args: ['amount'],
		description: "Sends you an offer with the TF2 price of the unique games.",
		admin: false,
		exec: buytf
	},
	buygems: {
		args: ['amount'],
		description: "Sends you an offer with the gem price of the unique games.",
		admin: false,
		exec: buygems
	},
	buyrandom: {
		args: ['amount'],
		description: "Sends you an offer with the CSGO price of the unique games.",
		admin: false,
		exec: buyrandom
	},
	buyrandomtf: {
		args: ['amount'],
		description: "Sends you an offer with the TF2 price of the unique games.",
		admin: false,
		exec: buyrandomtf
	},
	buyrandomgems: {
		args: ['amount'],
		description: "Sends you an offer with the gem price of the unique games.",
		admin: false,
		exec: buyrandomgems
	},
	retrieve: {
		description: "Sends you the key for the last games you paid for.",
		admin: false,
		exec: retrieve
	},
	cancel: {
		description: "Cancels your current offer",
		admin: false,
		exec: cancel
	}
}