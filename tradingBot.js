/**Basic trading bot*/

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

var logOnOptions = {
	"accountName": "***REMOVED***",
	"password": "***REMOVED***",
	"twoFactorCode": SteamTotp.getAuthCode(secrets.shared_secret)
};

if (fs.existsSync('steamguard.txt')) {
	logOnOptions.steamguard = fs.readFileSync('steamguard.txt').toString('utf8');
}

if (fs.existsSync('polldata.json')) {
	manager.pollData = JSON.parse(fs.readFileSync('polldata.json'));
}

community.login(logOnOptions,function(err,sessionID,cookies,steamguard) {
	if(err) {
		console.log("error occured "+err.message);
		process.exit(1);
	}
	fs.writeFile('steamguard.txt', steamguard);

	console.log("Logged into Steam");
	
	manager.setCookies(cookies, function(err) {
		if (err) {
			console.log(err);
			process.exit(1); 
			return;
		}

		console.log("Got API key: " + manager.apiKey);
	});
	
	
});