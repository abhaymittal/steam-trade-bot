var request=require('../node_modules/request');
var fs=require('fs');
function isUserBanned(steamid,logger,callback) {
	request.get(
		{
			"uri":"http://backpack.tf/api/IGetUsers/v3/",
			"qs" : {
				"format":"json",
				"steamids":steamid
			},
			"json":true
		},
		function(err,response,body) {
			if(err) {
				logger.error("error occured while retrieving data "+err.message);
				return;
			}
			
			user=body.response.players[steamid]; //get the player object
			if(user.backpack_tf_banned||user.steamrep_scammer||user.ban_economy||user.ban_community||user.ban_vac) {
				logger.info("User banned: "+steamid);
				callback(true); //player banned
			}
			else
				callback(false);
		}
	)
}


function isWeapon(item) {
	var itemType=item.getTag('Type'); //Item type should be one of 5 listed below
	if(!itemType) { //If type does not exist
		return false;
	}
	if(item.market_hash_name.match(/Slot token/i)) //Item type is in slot tokens as well
		return false;
	var weaponType=["Primary weapon", "Secondary weapon", "Melee weapon", "Primary PDA", "Secondary PDA"];
	if(weaponType.indexOf(itemType.name)!=-1) {
		return true;
	}
	return false;
}


/**
*	This function removes killstreak from weapon names
*/
function removeKS(weaponName) { 
	weaponName=weaponName.replace(/(Specialized |Professional |)Killstreak /i,"");
	return weaponName;
}


/**
*	This function returns the craft status of any item
*/
function getCraftStatus(item) {
	//If item description contains not usable in crafting then item is non-craftable
	var craftStatus=item.descriptions.filter(function(obj) { 
		if(obj.value.includes("Not Usable in Crafting"))
			return true;
		return false;
	});
	if(!craftStatus[0]) //It will contain a single item only
		return "Craftable";
	return "Non-Craftable";
}


/**
*	This function returns the buying price of an item. It will not count killstreaks and paints attached.
*	@return: price of the item, price.metal=-1 if invalid items present
*/
function buyingPrice(itemList,buyDB,keyList,logger) {
	//initialize the price
	var price=new Object();
	price.metal=0;
	price.keys=0;
	//traverse over the item list
	for(var itemIndex in itemList) {
		if(itemList[itemIndex].appid!=440) {//reject non-tf2 items
			price.metal=-1;
			return price;
		}
		if(isWeapon(itemList[itemIndex])) { 
			//itemName=removeKS(itemList[itemIndex].market_hash_name);
			//if weapon is not strange, reject
			if(!(itemName.includes("Strange")||itemName.includes("strange"))) {
				price.metal=-1;
				return price;
			}
		}
		if(keyList.indexOf(itemList[itemIndex].market_hash_name)!=-1) {
			price.keys+=1;
			continue;
		}
		switch(itemList[itemIndex].market_hash_name) {//check if item is metal
			case "Scrap Metal":
				price.metal+=0.11;
				if(price.metal%1>=0.99)
					price.metal=Math.round(price.metal);
				continue;
				break;

			case "Reclaimed Metal":
				price.metal+=0.33;
				if(price.metal%1>=0.99)
					price.metal=Math.round(price.metal);
				continue;
				break;
				
			case "Refined Metal":
				price.metal+=1;
				continue;
				break;
		}
		craftable=getCraftStatus(itemList[itemIndex]);
		
		//check if item is present in buyDB
		if(!(buyDB.hasOwnProperty(itemList[itemIndex].market_hash_name)&&buyDB[itemList[itemIndex].market_hash_name].hasOwnProperty(craftable)))	 { 
			price.metal=-1; //decline trade if item not present
			return price;
		}
		
		price.metal+=buyDB[itemList[itemIndex].market_hash_name][craftable].metal;
		if(price.metal%1>=0.99)
			price.metal=Math.round(price.metal);
		price.keys+=buyDB[itemList[itemIndex].market_hash_name][craftable].keys;
	};
	return price;
}

/**
*	This function returns the paint attached to an item
*/
function getPaint(item) {
	var paint=item.descriptions.filter(function(obj) {
		if(obj.value.includes("Paint Color"))
			return true;
		return false;
	});
	if(!paint[0])
		return "No Paint"
	return paint[0].value.substring(13);
}


/**
*	This function returns the selling price of an item. 
*/
function sellingPrice(itemList,sellDB,keyList,logger) {
	//Initialize price
	var price=new Object();
	price.metal=0;
	price.keys=0;
	for(var itemIndex in itemList) {
		//console.log("Item = "+itemList[itemIndex].market_hash_name);
		if(keyList.indexOf(itemList[itemIndex].market_hash_name)!=-1) {
			price.keys+=1;
			continue;
		}
		switch(itemList[itemIndex].market_hash_name) { //check for metal
			case "Scrap Metal":
				price.metal+=0.11;
				if(price.metal%1>=0.99)
					price.metal=Math.round(price.metal);
				continue;
				break;

			case "Reclaimed Metal":
				price.metal+=0.33;
				if(price.metal%1>=0.99)
					price.metal=Math.round(price.metal);
				continue;
				break;
				
			case "Refined Metal":
				price.metal+=1;
				continue;
				break;
		}
		craftable=getCraftStatus(itemList[itemIndex]);
		paintColor=getPaint(itemList[itemIndex]);
		//search for item entry in sellDB
		if(!(sellDB.hasOwnProperty(itemList[itemIndex].market_hash_name)&&sellDB[itemList[itemIndex].market_hash_name].hasOwnProperty(craftable)&&sellDB[itemList[itemIndex].market_hash_name][craftable].hasOwnProperty(paintColor))) {
			price.metal=-1; //decline trade as item not present in database
			return price;
		}
		price.metal+=sellDB[itemList[itemIndex].market_hash_name][craftable][paintColor].metal;
		price.keys+=sellDB[itemList[itemIndex].market_hash_name][craftable][paintColor].keys;
			
	};
	return price;
};


function updateDB(buyDB,sellDB,logger) {
	var newBuy=null;
	var newSell=null;
	logger.info("Updating DB");
	if(fs.existsSync("database/newBuy.json")) {
		logger.info("New buy entry found");
		newBuy=JSON.parse(fs.readFileSync("database/newBuy.json"));
	}
	if(fs.existsSync("database/newSell.json")) {
		logger.info("New sell entry found");
		newSell=JSON.parse(fs.readFileSync("database/newSell.json"));
	}
	for(var prop in newBuy) {
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
	logger.info
}

function decrementBuyStock(itemList,buyDB,keyList) {
	for(var itemIndex in itemList) {
		if(keyList.indexOf(itemList[itemIndex].market_hash_name)!=-1) { //skip keys
			continue;
		}
		if(itemList[itemIndex].market_hash_name.includes("Metal"))//skip metal
			continue;
		craftable=getCraftStatus(itemList[itemIndex]);
		buyDB[itemList[itemIndex].market_hash_name][craftable].qty-=1;
	};
}

function decrementSellStock(itemList,sellDB,keyList) {
	for(var itemIndex in itemList) {
		if(keyList.indexOf(itemList[itemIndex].market_hash_name)!=-1) { //skip keys
			continue;
		}
		if(itemList[itemIndex].market_hash_name.includes("Metal"))//skip metal
			continue;
		craftable=getCraftStatus(itemList[itemIndex]);
		paintColor=getPaint(itemList[itemIndex]);
		sellDB[itemList[itemIndex].market_hash_name][craftable][paintColor].qty-=1;
	};
}


module.exports = {
	isUserBanned,
	buyingPrice,
	sellingPrice,
	updateDB,
	decrementBuyStock,
	decrementSellStock
};
