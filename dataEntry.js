/**
*	Script to create newBuy and newSell DB
*	@author: Abhay Mittal
*/

var fs=require('fs');
var rlSync=require('readline-sync');


doBuy=rlSync.question("Enter 1 to make buy entries, 0 to skip");
doBuy=parseInt(doBuy);

if(doBuy==1) {
	n=rlSync.question("Enter the number of buy entries");
	n=parseInt(n);

	var newBuy=new Object();

	for(var i=1;i<=n;i++) {
		name=rlSync.question("Enter item name: ");
		craft=rlSync.question("Enter 1 if craftable, 2 if non-craftable: ");
		craft=parseInt(craft);
		if(craft==1)
			craftStatus="Craftable";
		else
			craftStatus="Non-Craftable"
		metal=rlSync.question("Enter the metal price: ");
		metal=Math.round(parseFloat(metal)*100.0)/100.0;
		keys=rlSync.question("Enter the key price: ");
		keys=parseInt(keys);
		qty=rlSync.question("Enter the quantity of stock: ");
		qty=parseInt(qty);
		newBuy[name]=new Object();
		newBuy[name][craftStatus]=new Object();
		newBuy[name][craftStatus].metal=metal;
		newBuy[name][craftStatus].keys=keys;
		newBuy[name][craftStatus].qty=qty;
	}

	fs.writeFile("database/newBuy.json",JSON.stringify(newBuy));
}


doSell=rlSync.question("Enter 1 to make sell entries, 0 to skip");
doSell=parseInt(doSell);

if(doSell==1) {
	n=rlSync.question("Enter the number of sell entries");
	n=parseInt(n);

	var newSell=new Object();

	for(var i=1;i<=n;i++) {
		name=rlSync.question("Enter item name: ");
		craft=rlSync.question("Enter 1 if craftable, 2 if non-craftable: ");
		craft=parseInt(craft);
		if(craft==1)
			craftStatus="Craftable";
		else
			craftStatus="Non-Craftable"
		paint=rlSync.question("Enter the name of the paint(Enter if no paint): ");
		if(paint==="")
			paint="No Paint";
		metal=rlSync.question("Enter the metal price: ");
		metal=Math.round(parseFloat(metal)*100.0)/100.0;
		keys=rlSync.question("Enter the key price: ");
		keys=parseInt(keys);
		qty=rlSync.question("Enter the quantity of stock: ");
		qty=parseInt(qty);
		newSell[name]=new Object();
		newSell[name][craftStatus]=new Object();
		newSell[name][craftStatus][paint]=new Object();
		newSell[name][craftStatus][paint].metal=metal;
		newSell[name][craftStatus][paint].keys=keys;
		newSell[name][craftStatus][paint].qty=qty;
	}

	fs.writeFile("database/newSell.json",JSON.stringify(newSell));
}
