var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("strings.tt2",{somestring:"Bla ble bli blo blu"},function(err,output){
	process.stdout.write(output);
});
