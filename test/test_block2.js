var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("block2.tt2",{},function(err,output){
	process.stdout.write(output);
});
