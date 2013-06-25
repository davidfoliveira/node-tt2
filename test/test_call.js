var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("call.tt2",{ somefunc:function(x){return x+1}, someobject: { somefunc: function(x){this.data.feeling = (Math.random(1)>0.5?"fine":"sad");} } },function(err,output){
	process.stdout.write(output);
});
