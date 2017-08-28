var fs=require('fs');
var SteamTotp = require('steam-totp');

var responseObject;

if(fs.existsSync("data/REMOVED.2fa")) {
	responseObject = JSON.parse(fs.readFileSync('data/REMOVED.2fa'));
}

console.log(SteamTotp.getAuthCode(responseObject.shared_secret));
