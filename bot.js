const files = require('./utils/files');
const steam = require('./utils/steam');

const time = Date.now();
var ready = false;

files.setup(() => {
	steam.setup((error) => {
		if(error)
			return console.log("Error while initializing bot: " + error);
		console.log("Bot is ready! (took " + (Date.now() - time) + "ms)");

		ready = true;
	});
});

exports = module.exports = ready;