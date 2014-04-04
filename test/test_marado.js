var	
	Template = require('../lib/tt2').Template;
	t = new Template({INCLUDE_PATH:"test/view"});

t.process("marado.tt2",
	{ header_2: '<div class="zone" id="header_2" version="2"><span class="_placeholder">HEADER_2 v.2</span><div class="_controls"><button type="button" class="conf icon-wrench" elName="header_2" elVersion="2"></button><button type="button" class="add icon-plus-sign" elName="header_2" elVersion="2"></button></div></div>',
	  footer_2: '<div class="zone" id="footer_2" version="2"><span class="_placeholder">FOOTER_2 v.2</span><div class="_controls"><button type="button" class="conf icon-wrench" elName="footer_2" elVersion="2"></button><button type="button" class="add icon-plus-sign" elName="footer_2" elVersion="2"></button></div></div>',
	  hnav_2: '<div class="zone" id="hnav_2" version="3"><span class="_placeholder">HNAV_2 v.3</span><div class="_controls"><button type="button" class="conf icon-wrench" elName="hnav_2" elVersion="3"></button><button type="button" class="add icon-plus-sign" elName="hnav_2" elVersion="3"></button></div></div>',
	  rightbar: '<div class="zone" id="rightbar" version="1"><span class="_placeholder">RIGHTBAR v.1</span><div class="_controls"><button type="button" class="conf icon-wrench" elName="rightbar" elVersion="1"></button><button type="button" class="add icon-plus-sign" elName="rightbar" elVersion="1"></button></div></div>'
	},
	function(err,output){
		process.stdout.write(output);
	}
);
