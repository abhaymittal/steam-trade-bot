var request=require('../node_modules/request');
function isUserBanned(steamid,callback) {
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
				console.log("error occured while retrieving data "+err.message);
				return;
			}
			user=body.response.players[steamid];
			if(user.backpack_tf_banned||user.steamrep_scammer||user.ban_economy||user.ban_community||user.ban_vac) {
				console.log("User banned: "+steamid);
				callback(true);
			}
			else
				callback(false);
		}
	)
}


function isWeapon(item) {
	var itemType=item.getTag('Type');
	if(!itemType) {
		return false;
	}
	if(item.market_hash_name.match(/Slot token/i))
		return false;
	var weaponType=["Primary weapon", "Secondary weapon", "Melee weapon", "Primary PDA", "Secondary PDA"];
	if(weaponType.indexOf(itemType.name)!=-1) {
		return true;
	}
	return false;
}

function removeKS(weaponName) {
	weaponName=weaponName.replace(/(Specialized |Professional |)Killstreak /i,"");
	return weaponName;
}


function getCraftStatus(item) {
	var craftStatus=item.descriptions.filter(function(obj) {
		if(obj.value.includes("Not Usable in Crafting"))
			return true;
		return false;
	});
	if(!craftStatus[0])
		return "Craftable";
	return "Non-Craftable";
}



function buyingPrice(itemList,buyDB) {
	var price=new Object();
	price.metal=0;
	price.keys=0;
	for(var itemIndex in itemList) {
		if(itemList[itemIndex].appid!=440) {//reject non-tf2 items
			price.metal=-1;
			return price;
		}
		if(isWeapon(itemList[itemIndex])) {
			itemName=removeKS(itemList[itemIndex].market_hash_name);
			if(!(itemName.includes("Strange")||itemName.includes("strange"))) {
				price.metal=-1;
				return price;
			}
		}
		switch(itemList[itemIndex].market_hash_name) {
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
		if(!(buyDB.hasOwnProperty(itemList[itemIndex].market_hash_name)&&buyDB[itemList[itemIndex].market_hash_name].hasOwnProperty(craftable)))	 {
			price.metal=-1; //decline trade if item not present
			return price;
		}
		price.metal+=buyDB[itemList[itemIndex].market_hash_name][craftable].metal;
		console.log("Metal = "+price.metal);
		if(price.metal%1>=0.99)
			price.metal=Math.round(price.metal);
		price.keys+=buyDB[itemList[itemIndex].market_hash_name][craftable].keys;
	};
	console.log("Total price is "+price.metal+" metal and "+price.keys+" keys");
	return price;
}

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



function sellingPrice(itemList,sellDB) {
	var price=new Object();
	price.metal=0;
	price.keys=0;
	for(var itemIndex in itemList) {
		console.log("Item = "+itemList[itemIndex].market_hash_name);
		switch(itemList[itemIndex].market_hash_name) {
			case "Scrap Metal":
				price.metal+=0.11;
				if(price.metal%1>=0.99)
					price.metal=Math.round(price.metal);
				return;
				break;

			case "Reclaimed Metal":
				price.metal+=0.33;
				if(price.metal%1>=0.99)
					price.metal=Math.round(price.metal);
				return;
				break;
				
			case "Refined Metal":
				price.metal+=1;
				return;
				break;
		}
		craftable=getCraftStatus(itemList[itemIndex]);
		paintColor=getPaint(itemList[itemIndex]);
		console.log("Craft and paint = "+craftable+" "+paintColor);
		if(!(sellDB.hasOwnProperty(itemList[itemIndex].market_hash_name)&&sellDB[itemList[itemIndex].market_hash_name].hasOwnProperty(craftable)&&sellDB[itemList[itemIndex].market_hash_name][craftable].hasOwnProperty(paintColor))) {
			console.log("failed");
			price.metal=-1;
			return price;
		}
		price.metal+=sellDB[itemList[itemIndex].market_hash_name][craftable][paintColor].metal;
		price.keys+=sellDB[itemList[itemIndex].market_hash_name][craftable][paintColor].keys;
			
	};
	
	console.log("Total selling price is "+price.metal+" metal and "+price.keys+" keys");
	return price;
};

module.exports = {
	isUserBanned,
	buyingPrice,
	sellingPrice
};
