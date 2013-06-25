var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("default.tt2",{ zname: "Ze" },function(err,output){
	process.stdout.write(output);
});
