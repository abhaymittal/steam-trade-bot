/**
*Basic trading bot
*@author: Abhay Mittal
*/

// ------------------------------ Basic login setup ------------------------------
var SteamCommunity=require('steamcommunity');
var SteamTotp = require('steam-totp');

var TradeOfferManager = require('steam-tradeoffer-manager');
var fs=require('fs');

var community=new SteamCommunity();	

var manager = new TradeOfferManager({
	"domain": "localhost", 
	"language": "en", // english descriptions
	"pollInterval": 5000 //5 second poll
});
var secrets;
if(fs.existsSync("data\\***REMOVED***.2fa")) {
	secrets=JSON.parse(fs.readFileSync("data\\***REMOVED***.2fa"));
}
else {
	console.log("2FA file missing, exiting");
	process.exit(1);
}

//setup the logon options
var logOnOptions = {
	"accountName": "***REMOVED***",
	"password": "***REMOVED***",
	"twoFactorCode": SteamTotp.getAuthCode(secrets.shared_secret)
};

//read steamguard file
if (fs.existsSync('steamguard.txt')) {
	logOnOptions.steamguard = fs.readFileSync('steamguard.txt').toString('utf8');
}

//read polldata to prevent old offers from triggering event again
if (fs.existsSync('polldata.json')) {
	manager.pollData = JSON.parse(fs.readFileSync('polldata.json'));
}

//login to the steamcommunity
community.login(logOnOptions,function(err,sessionID,cookies,steamguard) {
	if(err) {
		console.log("error occured "+err.message);
		process.exit(1);
	}
	fs.writeFile('steamguard.txt', steamguard); 

	console.log("Logged into Steam");
	
	//use steamcommunity cookies for tradeoffer-manager
	manager.setCookies(cookies, function(err) {
		if (err) {
			console.log(err);
			process.exit(1); 
			return;
		}

		console.log("Got API key: " + manager.apiKey);
	});
	
	community.startConfirmationChecker(10000,secrets.identity_secret); //poll every 10 seconds and confirm
});

// ------------------------------ Utility Methods ------------------------------

manager.on('newOffer', function(offer) {
	console.log("New offer #" + offer.id + " from " + offer.partner.getSteam3RenderedID());
	offer.accept(function(err) {
		if (err) {
			console.log("Unable to accept offer: " + err.message);
		} else {
			community.checkConfirmations(); // Check for confirmations right after accepting the offer
			console.log("Offer accepted");
		}
	});
});

manager.on('receivedOfferChanged', function(offer, oldState) {
	console.log("Offer #" + offer.id + " changed: " + TradeOfferManager.getStateName(oldState) + " -> " + TradeOfferManager.getStateName(offer.state));

	if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
		offer.getReceivedItems(function(err, items) {
			if (err) {
				console.log("Couldn't get received items: " + err);
			} else {
				var names = items.map(function(item) {
					return item.name;
				});

				console.log("Received: " + names.join(', '));
			}
		});
	}
});

manager.on('pollData', function(pollData) {
	fs.writeFile('polldata.json', JSON.stringify(pollData));
});