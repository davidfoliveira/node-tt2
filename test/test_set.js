var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("set.tt2",{ time: function(){return new Date().getTime()} },function(err,output){
	process.stdout.write(output);
});
