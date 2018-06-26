const files = require('./files');
const offers = require('./offers');
const commands = require('./commands');
const bot = require('../bot')

const request = require('request');
const SteamUser = require('steam-user');
const client = new SteamUser();
const SteamTOTP = require('steam-totp');

var config = {};

exports.message = (steamid, message) => {
	client.chatMessage(steamid, message);
}

exports.broadcast = (message) => {
	for(let friend in client.myFriends) {
		if(client.myFriends[friend]) {
			if(client.myFriends[friend] == 3)
				client.chatMessage(friend, message);
		}
	}
}

exports.updatePersona = (total, csgo, tf, gems) => {
	client.gamesPlayed(total + " games | " + csgo + " CSGO | " + tf + " TF | " + gems + " GEMS");
}

exports.setup = callback => {
	config = files.getConfig();

	client.logOn({
		accountName: config.username,
		password: config.password,
		twoFactorCode: SteamTOTP.generateAuthCode(config.shared)
	});

	client.on('loggedOn', () => {
		client.setPersona(SteamUser.EPersonaState.Online);

		if(config.status != "none")
			client.gamesPlayed(config.status);
	});

	client.on('webSession', (sessionID, cookies) =>
		offers.setup(client, cookies, callback)
	);

	client.on('error', (error) => {
		callback(error);
	});

	client.on('friendsList', () => {
		let friends = client.myFriends;

		for(let friend in friends) {
			if(friends.hasOwnProperty(friend)) {
				let state = friends[friend];

				if(state == SteamUser.EFriendRelationship.RequestRecipient)
					client.addFriend(friend);
			}
		}
	});
}

client.on('friendRelationship', (sid, relationship) => {
	if(relationship == SteamUser.EFriendRelationship.RequestRecipient)
		client.addFriend(sid);

	if(relationship == SteamUser.EFriendRelationship.Friend) {
		exports.message(sid, "Thanks for adding me, type !help to get started.");
		offers.inviteUserToGroup(sid);
	}
});

client.on('friendMessage', (sender, message) => {
	if(message.startsWith("!")) {
		let command = message.substring(1, message.indexOf(" ") < 0 ? message.length : message.indexOf(" "));
		let args = message.substring(command.length + 2).split(" ");

		args = removeEmpty(args);

		commands.execute(sender, command, args);
	}
});

exports.getAppID = (title) => {
	let appid = files.getApps().byname[title.toLowerCase()];

	return appid == null ? "Invalid game" : parseInt(appid);
}

exports.getGameName = (appid) => {
	let name = files.getApps().byid[appid];

	return name;
}

exports.getApps = (callback) => {
	request({
		url: 'http://api.steampowered.com/ISteamApps/GetAppList/v0002/?format=json',
		json: true
	}, (error, response, body) => {
		if(error) {
			callback(error);
			return;
		}

		let appList = body.applist.apps;

		let json = {};
		json.byname = {};
		json.byid = {};

		for(let i = 0; i < appList.length; i++) {
			let app = appList[i];

			json.byname[app.name.toLowerCase()] = app.appid;
			json.byid[app.appid] = app.name;
		}

		callback(null, json);
	});
}

const removeEmpty = (array) => {
	for(let i = 0; i < array.length; i++) {
		if(array[i].trim() == '') {
			array.splice(i, 1);
			i--;
		}
	}

	return array;
}