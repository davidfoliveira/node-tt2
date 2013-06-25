var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("get.tt2",{ somevar: "yeeey!!",someobject: { somefunc: function(x){return x+1}, someproperty: "fine" } },function(err,output){
	process.stdout.write(output);
});
