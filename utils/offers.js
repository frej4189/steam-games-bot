const async = require('async');

const TradeOfferManager = require('steam-tradeoffer-manager');
var manager = null;

const SteamCommunity = require('steamcommunity');
var community = null;
const WebAPI = require('@doctormckay/steam-webapi');
var api = null;
const SteamID = require('steamid');

const steam = require('./steam');
const users = require('./users');
const files = require('./files');

var first = true;
var ongoing = false;

exports.setup = (client, cookies, callback) => {
	manager = new TradeOfferManager({
		steam: client,
		domain: "example.net"
	});
	community = new SteamCommunity();

	manager.setCookies(cookies);
	community.setCookies(cookies);
	api = new WebAPI(files.getConfig().apikey);
	if(first) {
		callback();
		first = false;
	}
	registerEvents();

	community.on('sessionExpired', () => {
		steam.web();
	});
}

exports.inviteUserToGroup = (user) => {
	if(!community)
		return setTimeout(exports.inviteUserToGroup, 2500, user);

	community.inviteUserToGroup(user, files.getConfig().group);
}

const registerEvents = () => {
	manager.on('newOffer', (offer) => {
		if(files.getConfig().admins.indexOf(offer.partner.toString()) < 0)
			return offer.decline();

		offer.accept((error, status) => {
			if(status == "pending") {
				community.acceptConfirmationForObject(files.getConfig().identity, offer.id);
			}
		});
	});

	manager.on('sentOfferChanged', (offer, oldState) => {
		if(offer.state == 3) {
			steam.message(offer.partner, "Offer accepted, handling..");

			let mark = () => {
				if(ongoing)
					return setTimeout(mark, 1500);

				ongoing = true;

				users.offerAccepted(offer.partner, error => {
					if(error) {
						ongoing = false;
						return steam.message(offer.partner, "Failed to mark your offer as accepted, please contact an admin about this.");
					}

					ongoing = false;

					users.handle(offer.partner, error => {
						if(error)
							steam.message(offer.partner, "Failed to retrieve the key for your game, please use !retrieve to get it.");
					});
				});
			}
			mark();
		} else if(offer.state == 7) {
			users.removeReservation(offer.partner, true, error => {
				if(error)
					return steam.message(offer.partner, "Offer was declined, you can now buy other games.");

				steam.message(offer.partner, "Offer was declined, you can now buy other games.");
			});
		}
	});
}

exports.hasOffer = (user, callback) => {
	manager.getOffers(1, (error, sent, received) => {
		if(error)
			return callback(error);

		if(sent.length) {
			let found = false;
			sent.forEach(offer => {
				if(offer.partner.getSteamID64() == user.toString()) {
					found = true;
					return;
				}
			});

			return callback(null, found);
		}

		callback(null, false);
	});
}

exports.withdraw = (partner, callback) => {
	let offer = manager.createOffer(partner);

	community.getUserInventoryContexts(community.steamID, (error, apps) => {
		if(error)
			return callback(error);

		let calls = [];

		for(let app in apps) {
			if(apps.hasOwnProperty(app)) {
				for(let context in apps[app].rgContexts) {
					if(apps[app].rgContexts.hasOwnProperty(context)) {
						let func = (callback) => {
							community.getUserInventoryContents(community.steamID.toString(), app, context, true, (error, items) => {
								if(error)
									return callback(error);

								callback(null, items);
							});
						}
						calls.push(func);
					}
				}
			}
		}

		async.series(calls, (error, results) => {
			if(error)
				return callback(error);

			let items = [];

			for(let i = 0; i < results.length; i++) {
				items = items.concat(results[i]);
			}

			offer.addMyItems(items);

			offer.send((error, status) => {
				if(error)
					return callback(error);

				if(status == "pending") {
					community.acceptConfirmationForObject(files.getConfig().identity, offer.id, error => {
						if(error)
							return callback(error);

						callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
					});
				} else if(status == "sent")
					callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
			});
		});
	});
}

exports.createBuyOffer = (partner, price, payment, full, callback) => {
	let removeFunc = (error) => {
		if(error) {
			steam.message(partner, "Failed to remove your reservation, please use !cancel if you want to buy more games, details might follow this message.");
			return callback(error);
		}
	}

	community.getSteamUser(new SteamID(partner.toString()), (error, user) => {
		if(error) {
			users.removeReservation(partner, true, removeFunc);
			return callback(error);
		}

		if(user.tradeBanState != "None") {
			users.removeReservation(partner, true, removeFunc);
			return callback("You must wait until you are out of trade hold before buying.");
		}

		let offer = manager.createOffer(partner);

		offer.getUserDetails((error, me, them) => {
			if(error) {
				users.removeReservation(partner, true, removeFunc);
				return callback(error);
			}

			if(them.escrowDays > 0) {
				users.removeReservation(partner, true, removeFunc);
				return callback("Please activate steam guard and wait 7 days before buying from me.");
			}

			if(full)
				offer.setMessage("Payment for your unique games.");
			else
				offer.setMessage("Because I don't have enough games to give you a full order, this order will not give you the full amount of games that you could have gotten, feel free to decline the trade request if you don't want this.");

			switch(payment) {
				case "csgo":
					
						community.getUserInventoryContents(partner, 730, 2, true, (error, items) => {
							if(error) {
								users.removeReservation(partner, true, removeFunc);
								return callback(error);
							}

							let accepted = files.getConfig().csgo;

							let count = 0;

							for(let i = 0; i < items.length; i++) {
								let item = items[i];

								if(accepted.indexOf(item.market_hash_name) < 0)
									continue;

								offer.addTheirItem(item);
								count++;

								if(count == price)
									break;
							}

							if(count < price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("You do not have enough accepted CS:GO items to purchase unique games.");
							}

							offer.send((error, status) => {
								if(error) {
									users.removeReservation(partner, true, removeFunc);
									return callback(error);
								}

								if(status == "pending") {
									community.acceptConfirmationForObject(files.getConfig().identity, offer.id, error => {
										if(error) {
											users.removeReservation(partner, true, removeFunc);
											return callback(error);
										}

										callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
									});
								} else if(status == "sent")
									callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
							});
						});
					break;
				case "tf":
					
						community.getUserInventoryContents(partner, 440, 2, true, (error, items) => {
							if(error) {
								users.removeReservation(partner, true, removeFunc);
								return callback(error);
							}

							let accepted = files.getConfig().tf;

							let count = 0;

							for(let i = 0; i < items.length; i++) {
								let item = items[i];

								if(accepted.indexOf(item.market_hash_name) < 0)
									continue;

								offer.addTheirItem(item);
								count++;

								if(count == price)
									break;
							}

							if(count < price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("You do not have enough accepted TF2 items to purchase unique games.");
							}

							offer.send((error, status) => {
								if(error) {
									users.removeReservation(partner, true, removeFunc);
									return callback(error);
								}

								if(status == "pending") {
									community.acceptConfirmationForObject(files.getConfig().identity, offer.id, error => {
										if(error) {
											users.removeReservation(partner, true, removeFunc);
											return callback(error);
										}

										callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
									});
								} else if(status == "sent")
									callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
							});
						});

					break;
				case "gems":
					
						community.getUserInventory(partner, 753, 6, true, (error, items) => {
							if(error) {
								users.removeReservation(partner, true, removeFunc);
								return callback(error);
							}

							let count = 0;

							for(let i = 0; i < items.length; i++) {
								let item = items[i];

								if(item.type.toLowerCase() != "steam gems")
									continue;

								count += item.amount;

								if(count > price) {
									item.amount -= (count - price);
									count -= (count - price);
								}

								offer.addTheirItem(item);

								if(count == price)
									break;
							}

							if(count < price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("You do not have enough gems to purchase unique games.");
							}

							
							if(count > price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("An unexpected error occurred, please try again.");
							}

							offer.send((error, status) => {
								if(error) {
									users.removeReservation(partner, true, removeFunc);
									return callback(error);
								}

								if(status == "pending") {
									community.acceptConfirmationForObject(files.getConfig().identity, offer.id, error => {
										if(error) {
											users.removeReservation(partner, true, removeFunc);
											return callback(error);
										}

										callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
									});
								} else if(status == "sent")
									callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
							});
						});

					break;
				default:
					users.removeReservation(partner, true, (error) => {
						if(error)
							return callback(error);

						return callback("Invalid payment method");
					});
			}
		});
	});
}

exports.createRandomBuyOffer = (partner, price, payment, full, callback) => {
	let removeFunc = (error) => {
		if(error) {
			steam.message(partner, "Failed to remove your reservation, please use !cancel if you want to buy more games, details might follow this message.");
			return callback(error);
		}
	}

	community.getSteamUser(new SteamID(partner.toString()), (error, user) => {
		if(error) {
			users.removeReservation(partner, true, removeFunc);
			return callback(error);
		}

		if(user.tradeBanState != "None") {
			users.removeReservation(partner, true, removeFunc);
			return callback("You cannot buy when while tradebanned.");
		}

		let offer = manager.createOffer(partner);

		offer.getUserDetails((error, me, them) => {
			if(error) {
				users.removeReservation(partner, true, removeFunc);
				return callback(error);
			}

			if(them.escrowDays > 0) {
				users.removeReservation(partner, true, removeFunc);
				return callback("Please activate steam guard and wait 7 days before buying from me.");
			}

			if(full)
				offer.setMessage("Payment for your random games.");
			else
				offer.setMessage("Because I don't have enough games to give you a full order, this order will not give you the full amount of games that you could have gotten, feel free to decline the trade request if you don't want this.");

			switch(payment) {
				case "csgo":
					
						community.getUserInventoryContents(partner, 730, 2, true, (error, items) => {
							if(error) {
								users.removeReservation(partner, true, removeFunc);
								return callback(error);
							}

							let accepted = files.getConfig().csgo;

							let count = 0;

							for(let i = 0; i < items.length; i++) {
								let item = items[i];

								if(accepted.indexOf(item.market_hash_name) < 0)
									continue;

								offer.addTheirItem(item);
								count++;

								if(count == price)
									break;
							}

							if(count < price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("You do not have enough accepted CS:GO items to purchase random games.");
							}

							offer.send((error, status) => {
								if(error) {
									users.removeReservation(partner, true, removeFunc);
									return callback(error);
								}

								if(status == "pending") {
									community.acceptConfirmationForObject(files.getConfig().identity, offer.id, error => {
										if(error) {
											users.removeReservation(partner, true, removeFunc);
											return callback(error);
										}

										callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
									});
								} else if(status == "sent")
									callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
							});
						});

					break;
				case "tf":
					
						community.getUserInventoryContents(partner, 440, 2, true, (error, items) => {
							if(error) {
								users.removeReservation(partner, true, removeFunc);
								return callback(error);
							}

							let accepted = files.getConfig().tf;

							let count = 0;

							for(let i = 0; i < items.length; i++) {
								let item = items[i];

								if(accepted.indexOf(item.market_hash_name) < 0)
									continue;

								offer.addTheirItem(item);
								count++;

								if(count == price)
									break;
							}

							if(count < price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("You do not have enough accepted TF2 items to purchase random games.");
							}

							offer.send((error, status) => {
								if(error) {
									users.removeReservation(partner, true, removeFunc);
									return callback(error);
								}

								if(status == "pending") {
									community.acceptConfirmationForObject(files.getConfig().identity, offer.id, error => {
										if(error) {
											users.removeReservation(partner, true, removeFunc);
											return callback(error);
										}

										callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
									});
								} else if(status == "sent")
									callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
							});
						});
					break;
				case "gems":
					

						community.getUserInventory(partner, 753, 6, true, (error, items) => {
							if(error) {
								users.removeReservation(partner, true, removeFunc);
								return callback(error);
							}

							let count = 0;

							for(let i = 0; i < items.length; i++) {
								let item = items[i];

								if(item.type.toLowerCase() != "steam gems")
									continue;

								count += item.amount;

								if(count > price) {
									item.amount -= (count - price);
									count -= (count - price);
								}
								
								offer.addTheirItem(item);

								if(count == price)
									break;
							}

							if(count < price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("You do not have enough gems to purchase random games.");
							}

							if(count > price) {
								users.removeReservation(partner, true, removeFunc);
								return callback("An unexpected error occurred, please try again.");
							}

							offer.send((error, status) => {
								if(error) {
									users.removeReservation(partner, true, removeFunc);
									return callback(error);
								}

								if(status == "pending") {
									community.acceptConfirmationForObject(files.getConfig().identity, offer.id, error => {
										if(error) {
											users.removeReservation(partner, true, removeFunc);
											return callback(error);
										}

										callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
									});
								} else if(status == "sent")
									callback(null, "https://steamcommunity.com/tradeoffer/" + offer.id);
							});
						});

					break;
				default:
					users.removeReservation(partner, true, (error) => {
						if(error)
							return callback(error);

						return callback("Invalid payment method");
					});
			}
		});
	});
}

exports.cancel = (user, callback) => {
	manager.getOffers(1, (error, sent, received) => {
		sent.forEach(offer => {
			if(offer.partner.toString() == user.toString())
				offer.cancel();
		});

		users.removeReservation(user, true, error => {
			callback(error);
		});
	});
}

exports.getOwnedGames = (user, callback) => {
	api.get('IPlayerService', 'GetOwnedGames', 1, {steamid: user}, (error, response) => {
		if(error)
			return callback(error);

		let games = response.games;
		let owned = [];
		games.forEach(game => {
			owned.push(game.appid);
		});

		callback(null, owned);
	});
}