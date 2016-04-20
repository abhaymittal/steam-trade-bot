/**
*Basic trading bot
*@author: Abhay Mittal
*/

var SteamCommunity=require('steamcommunity');
var SteamTotp = require('steam-totp');
var TradeOfferManager = require('steam-tradeoffer-manager');
var fs=require('fs');
var community=new SteamCommunity();	
var utilities=require('./scripts/utilities');



// ------------------------------ Basic login setup ------------------------------
var manager = new TradeOfferManager({
	"domain": "localhost", 
	"language": "en", // english descriptions
	"pollInterval": 5000 //5 second poll
});
var secrets = {
	"shared_secret":"***REMOVED***",
	"identity_secret":"***REMOVED***"
};

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

// ------------------------------ Read Database ------------------------------

var buyDB=JSON.parse(fs.readFileSync("database/buy.json"));
var sellDB=JSON.parse(fs.readFileSync("database/sell.json"));
var config=JSON.parse(fs.readFileSync("data/config.json"));

// ------------------------------ Store Updated DB and add new entries ------------------------------

function updateDB() {
	var newBuy=null,newSell=null;
	console.log("Updating DB");
	if(fs.existsSync("database/newBuy.json")) {
		console.log("New buy entry found");
		newBuy=JSON.parse(fs.readFileSync("database/newBuy.json"));
	}
	if(fs.existsSync("database/newSell.json")) {
		console.log("New sell entry found");
		newSell=JSON.parse(fs.readFileSync("database/newSell.json"));
	}
	for(var prop in newBuy) {
		console.log("prop = "+prop);
		buyDB[prop]=newBuy[prop];
	}
	for(var prop in newSell) {
		sellDB[prop]=newSell[prop];
	}
	if(fs.existsSync("database/newBuy.json")) {
		fs.unlinkSync("database/newBuy.json");
	}
	if(fs.existsSync("database/newSell.json")) {
		fs.unlinkSync("database/newSell.json");
	}

	fs.writeFile("database/buy.json",JSON.stringify(buyDB));
	fs.writeFile("database/sell.json",JSON.stringify(sellDB));
	console.log("Update done");
}

setInterval(updateDB(),1000*60*60); //update DB every hour

// ------------------------------ Trade Events ------------------------------

manager.on('newOffer', function(offer) {
	console.log("New offer #" + offer.id + " from " + offer.partner.getSteamID64());
	utilities.isUserBanned(offer.partner.getSteamID64(),function (result) { //If user is banned, decline trade
		if(result) { //User banned - decline trade
			console.log("User banned, declining");
			offer.decline(function(err) {
				if(err)
					console.log("Error occured while declining");
			});
			return;
		}
		
		//Continue with trade
		
		//decline gift offers and offers which only take items
		if((offer.itemsToGive==null)||(offer.itemsToReceive==null)) {
			if(offer.itemsToGive==null)
				console.log("Empty selling list");
			if(offer.itemsToReceive==null)
				console.log("Empty buying list");
			console.log("Declining trade as empty list");
			offer.decline(function(err) {
				if(err)
					console.log("Error occured while declining");
			});
			return;
		}
		
		//calculate the buying and selling price of items
		
		bp=utilities.buyingPrice(offer.itemsToReceive,buyDB,config.keyList);
		if(bp.metal==-1) {
			console.log("Buying list contains an invalid item, declining");
			offer.decline();
			return;
		}
		console.log("the buying price is "+bp.metal+ " metal and " +bp.keys+" Keys");
		sp=utilities.sellingPrice(offer.itemsToGive,sellDB,config.keyList);
		if(sp.metal==-1) {
			console.log("Selling list contains an invalid item, declining");
			offer.decline();
			return;
		}
		console.log("the selling price is "+sp.metal+ " metal and " +sp.keys+" Keys");
		//If bp >= sp, accept the trade
		if((bp.keys>sp.keys)||((bp.keys==sp.keys)&&(Math.round(bp.metal*100)>=Math.round(sp.metal*100)))) {
			console.log("Accepting offer");
			offer.accept(function(err) {
				if(err)
					console.log("error occured while confirming");
				else {
					community.checkConfirmations();
					console.log("Offer accepted");
					//decrease number of item in buy and sell list
				}
			});
		}
		else {
			console.log("Declining as price offered is less");
			offer.decline();
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
/*
manager.on('pollData', function(pollData) {
	fs.writeFile('polldata.json', JSON.stringify(pollData));
});*/