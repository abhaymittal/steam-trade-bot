/**
*Basic trading bot
*@author: Abhay Mittal
*/
/**
*	TODO
*	What if user sells more copies of item than required
*	
*/
var SteamCommunity=require('steamcommunity');
var SteamTotp = require('steam-totp');
var TradeOfferManager = require('steam-tradeoffer-manager');
var fs=require('fs');
var community=new SteamCommunity();	
var utilities=require('./scripts/utilities');
var logger=require('./scripts/log');
var backpacktf=require('./scripts/backpacktf');



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

// ------------------------------ Settings ------------------------------
var config=JSON.parse(fs.readFileSync("config.json"));
var homeDir=process.env.OPENSHIFT_DATA_DIR ? process.env.OPENSHIFT_DATA_DIR+"/":"";
var connectRetry=5;

//setup the logon options
var logOnOptions = {
	"accountName": "***REMOVED***",
	"password": "***REMOVED***",
	"twoFactorCode": SteamTotp.getAuthCode(secrets.shared_secret)
};

//read steamguard file
if (fs.existsSync(homeDir+'steamguard.txt')) {
	logOnOptions.steamguard = fs.readFileSync(homeDir+'steamguard.txt').toString('utf8');
}

//read polldata to prevent old offers from triggering event again
if (fs.existsSync(homeDir+'data/polldata.json')) {
	manager.pollData = JSON.parse(fs.readFileSync(homeDir+'data/polldata.json'));
}

//login to the steamcommunity
function logIn() {
	community.login(logOnOptions,function(err,sessionID,cookies,steamguard) {
		if(err) {
			logger.error("error occured "+err.message);
			process.exit(1);
		}
		fs.writeFile(homeDir+'data/steamguard.txt', steamguard); 

		logger.info("Logged into Steam");
		connectRetry=5;
		
		//use steamcommunity cookies for tradeoffer-manager
		manager.setCookies(cookies, function(err) {
			if (err) {
				logger.error(err);
				process.exit(1); 
				return;
			}

			logger.info("Got API key: " + manager.apiKey);
		});
		
		community.chatLogon(); //Log on to the chat so that bot appears online
		community.startConfirmationChecker(10000,secrets.identity_secret); //poll every 10 seconds and confirm
	});
};

logIn();
// ---------- Log in to chat every 4 hours -----------
setInterval(function(){community.chatLogon();},1000*60*60*4);
// ------------------------------ Read Database ------------------------------

var buyDB=JSON.parse(fs.readFileSync(homeDir+"database/buy.json"));
var sellDB=JSON.parse(fs.readFileSync(homeDir+"database/sell.json"));


// ------------------------------ Store Updated DB and add new entries ------------------------------
utilities.updateDB(buyDB,sellDB,logger);
setInterval(function(){utilities.updateDB(buyDB,sellDB,logger);},1000*60*30); //update DB every half hour


// ------------------------------ Backpack tf heartbeat ------------------------------

//backpacktf.heartbeat(config.steamid,config.bptfToken,logger);
//setInterval(function(){backpacktf.heartbeat(config.steamid,config.bptfToken,logger);},1000*60*5); //send heartbeats every 5 minutes

// ------------------------------ Trade Events ------------------------------

manager.on('newOffer', function(offer) {
	logger.trade("New offer #" + offer.id + " from " + offer.partner.getSteamID64());
	utilities.isUserBanned(offer.partner.getSteamID64(),logger,function (result) { //If user is banned, decline trade
		if(result) { //User banned - decline trade
			logger.info("User banned, declining");
			offer.decline(function(err) {
				if(err)
					logger.error("Error occured while declining");
			});
			return;
		}
		//Reject if trade will incur escrow hold
		utilities.isEscrowHeld(offer,logger,function(result) {
			if(result) {
				logger.info("Declining trade due to escrow hold");
				offer.decline();
				return;
			}
			//Continue with trade
			
			//decline gift offers and offers which only take items
			if((offer.itemsToGive==null)||(offer.itemsToReceive==null)) {
				if(offer.itemsToGive==null)
					logger.info("Empty selling list");
				if(offer.itemsToReceive==null)
					logger.info("Empty buying list");
				logger.info("Declining trade as empty list");
				offer.decline(function(err) {
					if(err)
						logger.error("Error occured while declining");
				});
				return;
			}
			
			//calculate the buying and selling price of items
			
			bp=utilities.buyingPrice(offer.itemsToReceive,buyDB,config.keyList,logger);
			if(bp.metal==-1) {
				logger.info("Buying list contains an invalid item, declining");
				offer.decline();
				return;
			}
			logger.info("The price of items to receive: "+bp.metal+ " metal and " +bp.keys+" Keys");
			sp=utilities.sellingPrice(offer.itemsToGive,sellDB,config.keyList,logger);
			if(sp.metal==-1) {
				logger.info("Selling list contains an invalid item, declining");
				offer.decline();
				return;
			}
			logger.info("The price of items to sell: "+sp.metal+ " metal and " +sp.keys+" Keys");
			//If bp >= sp, accept the trade
			//if(((bp.keys>sp.keys)&&(bp.metal>=sp.metal))||((bp.keys==sp.keys)&&(Math.round(bp.metal*100)>=Math.round(sp.metal*100)))) {
			if((bp.keys>=sp.keys)&&(Math.round(bp.metal*100)>=Math.round(sp.metal*100))) {
				logger.info("Accepting offer");
				offer.accept(function(err) {
					if(err)
						logger.error("error occured while confirming");
					else {
						community.checkConfirmations();
						logger.info("Offer accepted");
						//decrease number of item in buy and sell list
						utilities.decrementBuyStock(offer.itemsToReceive,buyDB,config.keyList);
						utilities.decrementSellStock(offer.itemsToGive,sellDB,config.keyList);
						utilities.updateDB(buyDB,sellDB,logger); //update DB
					}
				});
			}
			else {
				logger.info("Declining as price offered is less");
				offer.decline();
			}
		});
	});
});

manager.on('receivedOfferChanged', function(offer, oldState) {
	logger.trade("Offer #" + offer.id + " changed: " + TradeOfferManager.getStateName(oldState) + " -> " + TradeOfferManager.getStateName(offer.state));

	if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
		offer.getReceivedItems(function(err, items) {
			if (err) {
				logger.error("Couldn't get received items: " + err);
			} else {
				var names = items.map(function(item) {
					return item.name;
				});

				logger.info("Received: " + names.join(', '));
			}
		});
	}
});

manager.on('pollData', function(pollData) {
	fs.writeFile(homeDir+'data/polldata.json', JSON.stringify(pollData));
});


// ------------------------------ Handle web session ------------------------------

community.on('sessionExpired', function(err) {
	community.login(logOnOptions,function(err,sessionID,cookies,steamguard) {
		if(err) {
			connectRetry-=1;
			if(connectRetry==0) {
				connectRetry=5;
				setTimeout(function(){logIn();},1000*60*30); // try again after 30 minutes
			}
		}
		fs.writeFile(homeDir+'data/steamguard.txt', steamguard); 

		logger.info("Logged into Steam");
		connectRetry=5;
		
		//use steamcommunity cookies for tradeoffer-manager
		manager.setCookies(cookies, function(err) {
			if (err) {
				logger.error(err);
				process.exit(1); 
				return;
			}

			logger.info("Got API key: " + manager.apiKey);
		});
		
		community.chatLogon(); //Log on to the chat so that bot appears online
		community.startConfirmationChecker(10000,secrets.identity_secret); //poll every 10 seconds and confirm
	});
});

community.on('chatLoggedOff',function() {
	community.chatLogon();
});
