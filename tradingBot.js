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
var Hapi=require('hapi');


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
			}

			logger.info("Got API key: " + manager.apiKey);
		});
		
		community.chatLogon(); //Log on to the chat so that bot appears online
		community.startConfirmationChecker(10000,secrets.identity_secret); //poll every 10 seconds and confirm
	});
};

logIn();
// ---------- Log in to chat every 30 min -----------
setInterval(function(){community.chatLogon();},1000*60*30);
// ------------------------------ Read Database ------------------------------

var buyDB=JSON.parse(fs.readFileSync(homeDir+"database/buy.json"));
var sellDB=JSON.parse(fs.readFileSync(homeDir+"database/sell.json"));

// ------------------------------ Setup Hapi Server -------------------------------------------------
const server=new Hapi.Server();
var serverPort = process.env.OPENSHIFT_NODEJS_PORT?process.env.OPENSHIFT_NODEJS_PORT:"3000";
var serverIP = process.env.OPENSHIFT_NODEJS_IP ? process.env.OPENSHIFT_NODEJS_IP: "127.0.0.1";

server.connection({ 
	"host":serverIP,
	"port": serverPort
});

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply('Pinged');
    }
});
/**
*	Route to list buyDB
*/
server.route({
    method: 'GET',
    path: '/buy',
    handler: function (request, reply) {
        reply(JSON.stringify(buyDB));
    }
});

/**
*	Route to list sellDB
*/
server.route({
    method: 'GET',
    path: '/sell',
    handler: function (request, reply) {
        reply(JSON.stringify(sellDB));
    }
});
//Two passwords to access the post requests
var pass1="b0Tp4ss1";
var pass2="P@$$w0rd@123"
error404={"statusCode": 404,"error": "Not Found"};

/**
*	Route to append new buy entries to the existing buyDB
*	Query Params:
*		pw1: First password
*		pw2: Second password
*/
server.route({
    method: ['POST'],
    path: '/appendbuy',
    handler: function (request, reply) {
		if((request.query.pw1===pass1)&&(request.query.pw2===pass2)) {
			var newBuy=request.payload;
			for(var prop in newBuy) {
				buyDB[prop]=newBuy[prop];
			}
			utilities.saveBuyDB(buyDB);
			logger.info("DB Update => Add buy stock");
			reply('updated buy db');
		}
		else {
			reply(error404);
		}
    }
});


/**
*	Route to append new sell entries to the existing sellDB
*	Query Params:
*		pw1: First password
*		pw2: Second password
*/
server.route({
    method: ['POST'],
    path: '/appendsell',
    handler: function (request, reply) {
		if((request.query.pw1===pass1)&&(request.query.pw2===pass2)) {
			var newSell=request.payload;
			for(var prop in newSell) {
				sellDB[prop]=newSell[prop];
			}
			utilities.saveSellDB(sellDB);
			logger.info("DB Update => Add sell stock");
			reply('updated sell db');
		}
		else {
			reply(error404);
		}
    }
});


/**
*	Route to remove buy entries from the existing buyDB
*	Query Params:
*		pw1: First password
*		pw2: Second password
*		level: The level of entry to delete. Following possible values
*			0: Complete buyDB
*			1: Particular item
*			2: particular craft entry of an item (Craftable or Non-Craftable)
*/
server.route({
    method: ['POST'],
    path: '/removebuy', 
    handler: function (request, reply) {
		if((request.query.pw1===pass1)&&(request.query.pw2===pass2)) {
			var level=request.query.level;
			var removeDB=request.payload;
			switch(parseInt(level)) {
				case 0:
					buyDB={};
					break;
				case 1:
					for(var itemName in removeDB) {
						console.log(itemName);
						delete buyDB[itemName];
					}
					break;
				case 2:
					for(var itemName in removeDB) {
						for(var craftStatus in removeDB[itemName])
							delete buyDB[itemName][craftStatus];
					}
					break;
				default:
					reply(error404);
					return;
			}
			utilities.saveBuyDB(buyDB);
			logger.info("DB Update => Remove buy entries | level = "+request.query.level);
			logger.info("Payload => "+JSON.stringify(request.payload));
			reply('Removed buy entries');
		}
		else {
			reply(error404);
		}
    }
});




/**
*	Route to remove sell entries from the existing sellDB
*	Query Params:
*		pw1: First password
*		pw2: Second password
*		level: The level of entry to delete. Following possible values
*			0: Complete buyDB
*			1: Particular item
*			2: particular craft entry of an item (Craftable or Non-Craftable)
*			3: particular paint in some craft entry of an item
*/
server.route({
    method: ['POST'],
    path: '/removesell', 
    handler: function (request, reply) {
		if((request.query.pw1===pass1)&&(request.query.pw2===pass2)) {
			var level=request.query.level;
			var removeDB=request.payload;
			switch(parseInt(level)) {
				case 0:
					sellDB={};
					break;
				case 1:
					for(var itemName in removeDB) {
						console.log(itemName);
						delete sellDB[itemName];
					}
					break;
				case 2:
					for(var itemName in removeDB) {
						for(var craftStatus in removeDB[itemName])
							delete sellDB[itemName][craftStatus];
					}
					break;
				case 3:
					for(var itemName in removeDB) {
						for(var craftStatus in removeDB[itemName]) {
							for (var paint in removeDB[itemName][craftStatus])
								delete sellDB[itemName][craftStatus][paint];
						}		
					}
					break;
				default:
					reply(error404);
					return;
			}
			utilities.saveSellDB(sellDB);
			logger.info("DB Update => Remove sell entries | level = "+request.query.level);
			logger.info("Payload => "+JSON.stringify(request.payload));
			reply('Removed sell entries');
		}
		else {
			reply(error404);
		}
    }
});







server.start((err) => {

    if (err) {
        throw err;
    }
    logger.info('Server running at:', server.info.uri);
});



// ------------------------------ Backpack tf heartbeat ------------------------------

backpacktf.heartbeat(config.steamid,config.bptfToken,logger);
setInterval(function(){backpacktf.heartbeat(config.steamid,config.bptfToken,logger);},1000*60*5); //send heartbeats every 5 minutes

// ------------------------------ Trade Events ------------------------------

manager.on('newOffer', function(offer) {
	logger.trade("Offer " + offer.id + ": by " + offer.partner.getSteamID64());
	utilities.isUserBanned(offer.partner.getSteamID64(),logger,function (result) { //If user is banned, decline trade
		if(result) { //User banned - decline trade
			logger.info("Offer "+offer.id+": User banned, declining");
			offer.decline(function(err) {
				if(err)
					logger.error("Offer "+offer.id+": Error occured while declining [user ban]");
			});
			return;
		}
		//Reject if trade will incur escrow hold
		utilities.isEscrowHeld(offer,logger,function(result) {
			if(result) {
				logger.info("Offer "+offer.id+": Declining trade due to escrow hold");
				offer.decline();
				return;
			}
			//Continue with trade
			
			//decline gift offers and offers which only take items
			if((offer.itemsToGive==null)||(offer.itemsToReceive==null)) {
				if(offer.itemsToGive==null)
					logger.info("Offer "+offer.id+": Empty selling list");
				if(offer.itemsToReceive==null)
					logger.info("Offer "+offer.id+": Empty buying list");
				logger.info("Offer "+offer.id+": Declining trade as empty list");
				offer.decline(function(err) {
					if(err)
						logger.error("Offer "+offer.id+": Error occured while declining [empty list]");
				});
				return;
			}
			
			//calculate the buying and selling price of items
			
			bp=utilities.buyingPrice(offer.itemsToReceive,buyDB,config.keyList,logger);
			if(bp.metal==-1) {
				logger.info("Offer "+offer.id+": Invalid buy item, decline");
				offer.decline();
				return;
			}
			logger.info("Offer "+offer.id+": The price of items to receive: "+bp.metal+ " metal and " +bp.keys+" Keys");
			sp=utilities.sellingPrice(offer.itemsToGive,sellDB,config.keyList,logger);
			if(sp.metal==-1) {
				logger.info("Offer "+offer.id+": Invalid sell item, decline");
				offer.decline();
				return;
			}
			logger.info("Offer "+offer.id+": The price of items to sell: "+sp.metal+ " metal and " +sp.keys+" Keys");
			//If bp >= sp, accept the trade
			//if(((bp.keys>sp.keys)&&(bp.metal>=sp.metal))||((bp.keys==sp.keys)&&(Math.round(bp.metal*100)>=Math.round(sp.metal*100)))) {
			if(((bp.keys==sp.keys)&&(Math.round(bp.metal*100)>=Math.round(sp.metal*100)))||((bp.keys>sp.keys)&&(Math.round(bp.metal*100)>=Math.round(sp.metal*100)))) {
				logger.info("Offer "+offer.id+": Accept");
				offer.accept(function(err) {
					if(err)
						logger.error("error occured while confirming");
					else {
						community.checkConfirmations();
						//decrease number of item in buy and sell list
						utilities.decrementBuyStock(offer.itemsToReceive,buyDB,config.keyList);
						utilities.decrementSellStock(offer.itemsToGive,sellDB,config.keyList);
						utilities.saveBuyDB(buyDB);
						utilities.saveSellDB(sellDB);
						logger.info("DB Update => Updated both buy and sell DB");
						logger.info("Offer "+offer.id+": Got "+bp.keys+" keys and "+bp.metal+" metal for "+sp.keys+" keys and "+sp.metal+" metal");
						var names = offer.itemsToReceive.map(function(item) {
							return item.name;
						});
						logger.trade("Offer " + offer.id + ": Received: " + names.join(', '));
						var names = offer.itemsToGive.map(function(item) {
							return item.name;
						});
						logger.trade("Offer " + offer.id + ": Sold: " + names.join(', '));
					}
				});
			}
			else {
				logger.info("Offer "+offer.id+": Decline => Less price offered");
				offer.decline();
			}
		});
	});
});

manager.on('receivedOfferChanged', function(offer, oldState) {
	logger.trade("Offer " + offer.id + ": " + TradeOfferManager.getStateName(oldState) + " -> " + TradeOfferManager.getStateName(offer.state));
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
				setTimeout(function(){logger.info("Couldn't reach server, will log in after 30 min");logIn();},1000*60*30); // try again after 30 minutes
			}
			return;
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
