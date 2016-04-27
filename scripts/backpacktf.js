var request=require('../node_modules/request');
var bpKey="56fd0eacc440451d01070316";
var bpToken="56fd0e8dc4404519201a7d06";
var steamid="76561198170453459";

function getUserListings(steamid,key) {
	request.get(
		{
			"uri":"http://backpack.tf/api/IGetUserListings/v2",
			"qs" : {
				"format":"json",
				"steamid":steamid,
				"key":key
			},
			"json":true
		},
		function(err,response,body) {
			if(err) {
				logger.error("error occured while retrieving data "+err.message);
				return;
			}
			
			console.log(body.response.listings);
		}
	);
}

/**
* Function to automatically post to backpack.tf that bot is online
*/
function heartbeat(steamid, token, logger) {
	request.post(
		{
			"uri": "http://backpack.tf/api/IAutomatic/IHeartBeat/",
			"form": {
				"method": "alive",
				"version": "1.2.4",
				"steamid": steamid,
				"token": token
			},
			"json":true
		},
		function(err,response,body) {
			if(err)
				logger.err("Error sending heartbeat; "+err.message);
			else if (response.statusCode !== 200)
				logger.error("Connection error: HTTP status code: "+response.statusCode);
			else if (!body.success)
				logger.error("Invalid token");
		}
	);
}

module.exports = {
	heartbeat
};
