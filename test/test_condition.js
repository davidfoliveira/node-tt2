var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("condition.tt2",{hour: (new Date()).getHours(), feeling: "flying"},function(err,output){
	process.stdout.write(output);
});
