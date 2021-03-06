var Winston=require('../node_modules/Winston');
var homeDir=process.env.OPENSHIFT_DATA_DIR ? process.env.OPENSHIFT_DATA_DIR+"/":"";
const LOG = {
	LEVELS: {
		"trade":0,
		"error": 1,
		"warn": 2,
		"debug": 3,
		"info": 4
		
	},
	COLORS: {
		"debug": "blue",
		"info": "white",
		"warn": "yellow",
		"error": "red",
		"trade": "cyan"
	}
};

var logger = new Winston.Logger({
	"levels": LOG.LEVELS,
	"colors": LOG.COLORS,
	"transports": [
            new (Winston.transports.Console)({
                colorize: true, 
                level: 'info'
            }),
            new (Winston.transports.File)({
				name: 'log',
                level: 'info', 
                timestamp: true, 
                filename: homeDir+'logs/bot.log', 
                json: false
            }),
			new (Winston.transports.File)({
				name: 'tradeLog',
                level: 'trade', 
                timestamp: true, 
                filename: homeDir+'logs/trade.log', 
                json: false
            })
        ]
});

module.exports=logger;

