/**
* Get 2 factor OTP
*/

var fs=require('fs');
var SteamTotp = require('steam-totp');

var responseObject;

if(fs.existsSync("data\\***REMOVED***.2fa")) {
	responseObject = JSON.parse(fs.readFileSync('***REMOVED***.2fa'));
}

console.log(SteamTotp.getAuthCode(responseObject.shared_secret));