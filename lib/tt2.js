"use strict";

/*
 * TT2 - Javascript Pseudo-TemplateToolkit2 module
 *
 * TemplateToolkit2-alike processor
 *
 * Version: 0.0.3
 * Author:  David Oliveira <d.oliveira@prozone.org>
 */

 /*
   TODO:

   - Multiline (;) support
   - Keep variables state inside include
   - NOT, AND, OR operators - confirmar como funciona o NOT (se se aplica apenas à proxima expressao a todo o conjunto expressao)
   - INSERT command support
   - WRAPPER command support
   - SWITCH/CASE command support
   - WHILE command support
   - MACRO command support
   - TRY/THROW/CATCH/FINAL support
   - RETURN/STOP/CLEAR support
   - Filtering
   - Ternary operator support
  */

 var
	fs		= require('fs'),
 	fileLastStat	= { },
 	codeCache	= { },
 	tagRx		= /^([\s\S]*?)\[%\s*(#?)([\s\S]+?)\s*(\-?)%\](\s*)/,
 	fnTagRx		= /^\s*(PROCESS|BLOCK|IF|UNLESS|ELSE|ELSIF|END|FOREACH|GET|CALL|SET|DEFAULT|INCLUDE|NEXT|LAST)\s*((?:"[^"]*"|'[^']*'|[^;]+)*)(;?)\s*/,
// 	xprRx		= /^\s*(\s*\()*\s*(?:"([^"]*)"|'([^']*)'|(\S+\s*\([^\)]*\)|[^\s\(\)]+))\s*(\s*\))*\s*/,
 	xprRx		= /^\s*(\s*\()*\s*(?:"([^"]*)"|'([^']*)'|(\S+\([^\)]*\)|[^\s\(\)]+))\s*(\s*\))*\s*/,
 	assignRx	= /^\s*([\w\.]+)\s*=\s*(.*?)\s*(?:#.*)?$/,
 	valueRx		= /^\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*/,
 	fnConvTable	= {
 		GET:		_convertGET,
 		CALL:		_convertCALL,
 		SET:		_convertSET,
 		DEFAULT:	_convertDEFAULT,
 		INCLUDE:	_convertINCLUDE
 	};


function loadTemplate(file,handler) {

	var
		TT = this;

//	console.log("Loading template: "+file);

	// Read file contents

	fs.readFile(file,function(err,data){
		if ( err ) {
			console.log("Error reading file: ",err);
			return handler(err,null);
		}

		// Convert the template into JS

//		console.log("Converting "+file);
		TT.convertTemplate(data.toString('utf-8'),function(err,jsCode){
			if ( err )
				return handler(err,null);

			var
				binCode;

			try {
				var _tt2Fn;
				binCode = eval(jsCode);
			}
			catch(ex) {
				console.log("Exception: ",ex);
				console.log("Faulty code: ",jsCode);
				if ( ex.stack )
					console.log("Stacktrace: ",ex.stack);
				return handler(ex,null);
			}

			handler(null,binCode);
		},file);

	});

}

function convertTemplate(str,handler,ctx) {

//	console.log("Converting template");

	var
		TT = this,
		matched,
		aux = {
			deep: 0,
			indent: "  ",
			headerCode: { _: "_tt2Fn = function(tto,depID,handler){\n" },
			middleCode: { _: "" },
			finishCode: { _: "  return tto.finalize(depID);\n" },
			inside: [],
			elifs: 0
		},
		code = aux.middleCode,
		insideBlock = 0,
		currentScope = "";

	try {

		// Use regexp for getting content and expressions (special tags)

		do {
			matched = false;
			str = str.replace(tagRx,function(all,content,comment,tcode,opts,spaces){
				matched = true;

				// Comment ?

				if ( comment )
					return content;

				// Have content ?

				if ( content != "" )
					code._ += aux.indent+ "tto.print('"+_encodeText(content)+"');\n";

				// Is a function tag

				if ( tcode.match(fnTagRx) ) {
					var
						xprmatched,
						xprnum = 0,
						keepGoing;
					do {
						xprmatched = false;
						tcode = tcode.replace(fnTagRx,function(all,fn,args){
							fn = fn.toUpperCase();
							xprmatched = true;
							keepGoing = false;
							currentScope = aux.inside[aux.inside.length-1];

							// End of something that didn't start
							if ( fn == "END" && !currentScope )
								throw new Error("Found END statement on a non open block on: "+all+" of "+str+" (on "+ctx+")");

							// Conditions

							if ( TT.enabledFeatures == null || TT.enabledFeatures['CONDITIONS'] ) {
								if ( fn == "IF" ) {
									aux.inside.push("if");
									code._ += aux.indent+'tto._if ( '+TT._convertXpr(args)+",function(){ // <if>\n";
									aux.indent += "  ";
								}
								else if ( fn == "UNLESS" ) {
									aux.inside.push("if");
									code._ += aux.indent+'tto._if (!( '+TT._convertXpr(args)+") ) { // <if>\n";
									aux.indent += "  ";
								}
								else if ( fn == "ELSIF" ) {
									aux.elifs++;
//									aux.inside.push("if");
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code._ += aux.indent+"},\n"+aux.indent+"function(){ // \n"+aux.indent+'  tto._if ( '+TT._convertXpr(args)+", function(){ // <elsif>\n";
									aux.indent += "    ";
								}
								else if ( fn == "ELSE" ) {
//									aux.inside.push("if");
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code._ += aux.indent+'},\n'+aux.indent+'function(){ // </if><else>\n';
									aux.indent += "  ";
								}
								else if ( fn == "END" && currentScope == "if" ) {
									while ( aux.elifs > 0 ) {
										aux.indent = aux.indent.substr(0,aux.indent.length-2);
										code._ += aux.indent+"}); // </elsif>\n";
										aux.elifs--;
									}
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code._ += aux.indent+"}); // </if>\n"+aux.indent+"if ( tto._lastIfRV != null )\n"+aux.indent+"  return tto._lastIfRV;\n";
									aux.inside.pop();
								}
								else
									keepGoing = true;
							}
							else if ( TT.enabledFeatures && !TT.enabledFeatures['CONDITIONS'] ) {
								if ( fn == "END" && currentScope == "if" ) {
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									aux.inside.pop();
									code._ += aux.indent+"} // </fake_if>\n";
								}
								else if ( fn.match(/^(IF|ELSIF|ELSE|UNLESS)$/i) ) {
									aux.inside.push("if");
									code._ += aux.indent+"if ( 0 ) { // <fake_if>\n";
									aux.indent += "  ";
								}
								else
									keepGoing = true;
							}

							// Loops

							if ( keepGoing && (TT.enabledFeatures == null || TT.enabledFeatures['LOOPS']) ) {
								if ( fn == "FOREACH" && args.match(/^\s*(\w+)\s*in\s*([^\s%]+)/i) ) {
									var
										scopeVar = RegExp.$1,
										runVar = RegExp.$2,
										fn;
									if ( runVar.match(/\.sort$/) ) {
										runVar = runVar.replace(/\.sort$/i,"");
										fn = "sort";
									}
									code._ += aux.indent+"tto._foreach("+TT._convertXpr(runVar)+",\""+fn+"\",function(i){ // <loop>\n";
									aux.indent += "  ";
									aux.inside.push("loop");
									code._ += aux.indent+"tto.setvar('"+scopeVar+"',i);\n";
								}
								else if ( fn == "NEXT" )
									code._ += aux.indent+"return 1;\n";
								else if ( fn == "LAST" )
									code._ += aux.indent+"return 0;\n";
								else if ( fn == "END" && currentScope == "loop") {
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code._ += aux.indent+"}); // </loop>\n";
									aux.inside.pop();
								}
								else
									keepGoing = true;
							}
							else if ( keepGoing && TT.enabledFeatures && !TT.enabledFeatures['LOOPS'] ) {
								if ( fn == "END" && currentScope == "loop" ) {
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									aux.inside.pop();
									code._ += aux.indent+"} // </fake_loop>\n";
								}
								else if ( fn.match(/^(FOREACH|WHILE)$/i) ) {
									aux.inside.push("loop");
									code._ += aux.indent+"if ( 0 ) { // <fake_loop>\n";
									aux.indent += "  ";
								}
								else
									keepGoing = true;
							}

							// Blocks

							if ( keepGoing && (TT.enabledFeatures == null || TT.enabledFeatures['BLOCKS']) ) {
								if ( fn.match(/BLOCK/i) ) {
									if ( !args.match(/^\w+$/) )
										throw new Exception("BLOCK directive needs a name, and just a name");

									code = aux.headerCode;
									code._ += aux.indent+"tto.setblock('"+args+"',function(){ // <block>\n";
									aux.indent += "  ";
									aux.inside.push('block');
									insideBlock++;
								}
								else if ( fn.match(/^END$/i) && currentScope == "block" ) {
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									aux.inside.pop();
									code._ += aux.indent+"}); // </block>\n";
									insideBlock--;
									if ( insideBlock == 0 )
										code = aux.middleCode;
								}
								else if ( fn.match(/^PROCESS/i) ) {
									if ( !args.match(/^\s*([^ ]+)(?:\s+(.*))?$/) )
										throw new Error("Invalid PROCESS call: 'PROCESS "+args+"'");
									var
										blockName = RegExp.$1,
										incArgs = TT._convertAssingList(RegExp.$2);

//console.log("Process block "+blockName+": ",incArgs);
									code._ += aux.indent+"tto.runblock('"+blockName+"',"+incArgs+");\n";
								}
								else
									keepGoing = true;
							}

							// Other functions

							if ( (TT.enabledFeatures == null || TT.enabledFeatures[fn]) && fnConvTable[fn] != null ) {
								var fnCode = fnConvTable[fn].apply(TT,[args,aux]);
								if ( fnCode != null && fnCode != "" )
									code._ += fnCode;
							}

							return "";
						});

					} while ( xprmatched );

				}

				// Is a SET without SET ? (assignment)

				else if ( tcode.match(assignRx) ) {
					while ( tcode.match(assignRx) ) {
						code._ += TT._convertSET(tcode,aux);
						tcode = tcode.replace(assignRx,"");
					}
				}

				// So is a GET without GET (expression return)

				else {
//					code._ += aux.indent+"tto.print("+_convertXpr(tcode)+");\n";
					code._ += aux.indent+TT._convertGET(tcode,aux)+"\n";
				}

				// Spaces or not spaces

				if ( opts == "-" )
					spaces = spaces.replace(/^\n/,"");
				if ( spaces.length > 0 )
					code._ += aux.indent+"tto.print('"+_encodeText(spaces)+"');\n";

				return "";
			});

		} while ( matched );

	}
	catch(ex) {
		// Aborted for some reason ?
		console.log("Error running template: ",ex);
		return handler(ex,null);
	}


	// Last text

	str = str.replace(/^([\s\S]+?)$/,function(a,b){
		code._ += aux.indent+'tto.print(\''+_encodeText(b)+"');\n";
		return "";
	});

	// Function finish

	var _code = aux.headerCode._ + aux.middleCode._ + aux.finishCode._ + "}\n";

	// If nothing is pending, call the handler!
//console.log("code: ",_code);
	handler(null,_code);

}

function _convertXpr(xpr) {

	var
		TT = this,
		match,
		parts = [],
		ecpars = " ";

	do {
		match = false;
		xpr = xpr.replace(xprRx,function(a,opar,str1,str2,expr,cpar){
			match = true;
			var el = str1 || str2 || expr;

			if ( opar != null )
				parts.push(opar);

			if ( str1 != null )
				parts.push(TT._convertQuotedStr(str1));
			else if ( str2 != null )
				parts.push("\'"+str2+"\'");
			else if ( el.match(/^not$/i) || el == "!" ) {
				parts.push("!(");
				ecpars += ")";
			}
			else if ( el.match(/^\s*and\s*/i) )
				parts.push(" && ");
			else if ( el.match(/^\s*or\s*/i) )
				parts.push("||");
			else if ( el.match(/^\s*is\s*/i) )
				parts = parts.concat(["typeof(",parts.pop(),") == "]);
			else if ( el == "=" )
				parts.push("==");
			else if ( el == "_" )
				parts.push("+");
			else if ( el.match(/^\d/) )
				parts.push(el);
			else if ( el.match(/^([a-zA-Z\._\$]+)\.(\w+)\s*\((.*)\)\s*$/) ) {
				var
					prop = RegExp.$1,
					fn = RegExp.$2,
					args = RegExp.$3,
					isProp = false;

				if ( fn == "substr" || fn == "substring" )
					fn = "substring";
				else if ( fn == "length" ) {
					fn = "length";
					isProp = true;
				}
				else
					throw new Error("Unknown function '"+fn+"'");

				if ( isProp )
					parts.push("tto.getvar('"+prop+"')."+fn);
				else {
					parts.push("String.prototype."+fn+".apply(tto.getvar('"+prop+"'),["+args+"])");
				}
			}
			else if ( el.match(/^([a-zA-Z\._#\$][a-zA-Z0-9\._#\$]*)\s*\((.*)\)\s*$/) )
				parts.push("tto.getvar('"+RegExp.$1+"').apply(tto,["+RegExp.$2+"])");
			else if ( el.match(/^([a-zA-Z\._#\$][a-zA-Z0-9\._#\$]*)\s*\[(.*?)\]\s*$/) )
				parts.push("tto.getvar('"+RegExp.$1+"')[tto.getvar('"+RegExp.$2+"')]");
			else if ( el.match(/^([\!]*)([a-zA-Z\.#_\$][a-zA-Z0-9\.#_\$]*)/) )
				parts.push(RegExp.$1+"tto.getvar('"+_encodeText(RegExp.$2)+"')");
			else
				parts.push(el);

			if ( cpar != null )
				parts.push(cpar);

			return "";
		});
	} while ( match );

	return parts.join(' ')+(ecpars.length > 1 ? ecpars : "");

}

function _convertQuotedStr(str) {

	var
		TT = this;

	return ("\""+str.replace(/\$(\w+)/g,function(a,b){
		return "\"+tto.getvar('"+TT._encodeText(b)+"\')+\"";
	})+"\"").replace(/^\"\"\+|\+\"\"$/g,"");

}

function _convertAssingList(xprs) {

	var
		TT = this,
		matched,
		obj = "{";

	do {
		matched = false;
		xprs = xprs.replace(assignRx,function(all,prop,val){
			matched = true;
			obj += "\'"+_encodeText(prop)+"\': "+TT._convertXpr(val)+", ";
			return "";
		});
	} while ( matched );

	if ( obj.length > 3 )
		obj = obj.substr(0,obj.length-2);

	return obj+"}";

}

function _convertGET(args,aux) {

	if ( args == null || !args.match(/^\s*(\S+)(?:\s+([\/*+-]|div|mod)\s*([\d\.]+)\s*)?(?:\s+FILTER\s+(\w+))?\s*$/i) )
		throw new Error("GET directive syntax error: "+args);
	var
		TT = this,
		varName = RegExp.$1,
		opChar = RegExp.$2,
		opValue = RegExp.$3,
		filterName = RegExp.$4,
		extraExpr = "";

	if ( opChar == "div" )
		opChar = "/";
	else if ( opChar == "mod" )
		opChar = "%";
	if ( opChar && opValue != null )
		extraExpr = " "+opChar+" "+opValue;

	if ( filterName && !this.FILTERS[filterName] )
		filterName = null;

	return "tto.print(" + (filterName?"tto._filter('"+filterName+"',":"") + TT._convertXpr(varName) + extraExpr + (filterName?")":"") + ");";

}

function _convertCALL(args,aux) {

	if ( args == null || args.match(/^\s*$/) )
		throw new Error("CALL directive syntax error");

	return aux.indent+this._convertXpr(args)+";\n";

}

function _convertSET(args,aux) {

	var
		TT = this,
		code = "";

	while ( args.match(assignRx) ) {
		var
			varName = RegExp.$1,
			value = RegExp.$2;
		code += aux.indent+"tto.setvar('" +TT._encodeText(RegExp.$1)+ "'," +TT._convertXpr(RegExp.$2) +");\n";
		args = args.replace(assignRx,"");
	}

	return code;

}

function _convertDEFAULT(args,aux) {

	var
		TT = this,
		code = "";

	while ( args.match(assignRx) ) {
		code += aux.indent+"tto.setvar('" +TT._encodeText(RegExp.$1)+ "'," +TT._convertXpr(RegExp.$2) +",true);\n";
		args = args.replace(assignRx,"");
	}

	return code;

}

function _convertINCLUDE(args,aux) {

	var
		TT = this,
		argMatch = false,
		file,
		code = "";

	args = args.replace("\n"," ").replace(valueRx,function(all,qv,pv,thing){
		argMatch = true;
		file = qv || pv || thing;
		return "";
	});

	// Have no file to include ? Bye!

	if ( !argMatch || file == null || file == "" )
		throw new Error("INCLUDE directive without arguments");

	// Convert arguments into an object

	var
		incArgs = TT._convertAssingList(args);

	aux.finishCode._ = "  "+aux.finishCode._.replace(/\n/g,"\n  ")+aux.indent.substr(0,aux.indent-2)+"});\n";

	code = aux.indent+"return tto.include('"+TT._encodeText(file)+"',"+incArgs+",function(err){\n";
	aux.indent += "  ";

	return code;

}

function process(file,args,handler) {

	var
		TT = this,
		xargs = args || {};


	// Create TTO object

	var
		tto = {
			depID: 		0,
			data:		xargs,			// Data and arguments will be the same object
			defaults:	{ },			// Default variable values

			_files:		{ "0": file },
			_handlers:	{ "0": handler },	// Final process handler
			_callers:	{ "0": null },		// Callers of dependences
			_args:		{ "0": xargs },		// Arguments of includes
			_blocks:	{ },
			_blockArgs:	[ ],
			_o:		"",			// Output buffer

			_deep:		0,
			_deps:		0,			// Number of dependences
			_nextID:	1,
			_aborted:	false,			// If aborted during closure execution

			// Methods:

			print: function(v) {
				this._o += v;
			},
			getvar: function(name) {
console.log("GET var: ",name);
				var
					scopedArgs = this._args[this.depID];

				// Block call arguments

				for ( var x = this._blockArgs.length-1 ; x >= 0 ; x-- ) {
					var value = this._getvar(this._blockArgs[x],name);
					if ( value != null )
						return value;
				}

				return this._getvar(scopedArgs,name) || this._getvar(this.data,name) || this._getvar(this.defaults,name) || "";
			},
			_getvar: function(o,name) {
				var
					parts = name.split("."),
					part;

				if ( o == null )
					return null;
				while ( parts.length && (part = parts.shift()) != null ) {
					if ( part.match(/^\$(.*)$/) )
						part = this.getvar(RegExp.$1);
					else if ( part == "size" )
						return Object.keys(o).length;
					o = o[part];
					if ( o == null || (parts.length && typeof(o) != "object") )
						return null;
				}
				return o;
			},
			setvar: function(name,v,def) {
				var
					o = def ? this.defaults : this.data,
					parts = name.split("."),
					part;
        
				while ( parts.length > 1 ) {
					part = parts.shift();
					if ( o[part] == null || typeof(o[parts]) != "object" )
						o[part] = {};
					o = o[part];
				}
				o[parts.shift()] = v;
			},
			setblock: function(name,code) {
				this._blocks[name] = code;
			},
			runblock: function(name,args) {
				var
					self = this;

				self._blockArgs.push(args);
				if ( !self._blocks[name] )
					throw new Error("No such block '"+name+"'");

				self._blocks[name]();
				self._blockArgs.pop();
			},
			_if: function(cond,code,elsecode) {
				this._lastIfRV = cond ? code() : elsecode ? elsecode() : null;
				return this._lastIfRV;
			},
			_foreach: function(obj,opt,code) {
				if ( obj && obj instanceof Array ) {
					if ( opt == "sort" )
						obj = obj.sort();
					for ( var x = 0 ; x < obj.length ; x++ ) {
						var rv = code(obj[x]);
						if ( rv != null && !rv )
							return;
					}
				}
				else if ( obj && typeof(obj) == "object" ) {
					var ks = Object.keys(obj);
					if ( opt == "sort" )
						ks = ks.sort();
					for ( var x = 0 ; x < ks.length ; x++ ) {
						var rv = code(ks[x]);
						if ( rv != null && !rv )
							return;
					}
				}
			},
			_filter: function(name,data) {
				return TT.FILTERS[name](data);
			},
			include: function(file,args,handler) {

				var
					self = this,
					depID;

				// Correct file path

				if ( !file.match(/\.\w+/) )
					file += ".tt2";

				// Create a dependence

				this._deep++;
				depID = this._newdep(file,this.depID,handler,args);

				// Process template

				TT._processFile(self,file,depID,function(err){
					// Error ?

					if ( err ) {
						self._removedep(depID);
						self.aborted = true;
						return self._handlers["0"](err,null);
					}

					// Success

					handler(null,"");
				});

			},
			finalize: function() {

				var
					depID = this.depID,
					handler;

//				console.log("#"+depID+" Finalizing");

				// Aborted ? forget! the handler was already fired

				if ( this.aborted )
					return;

//				console.log("Finalized dep "+depID+" and jumping to dep "+this._callerOf(depID));

				// Not so deep :-)
				this._deep--;

				// Main code or a dependence ?

				if ( depID == "0" ) {

					// Finalizing with dependences ? wait!

					if ( this._deps > 0 ) {
//						console.log("#0 Refusing to finalize with dependences ("+this._deps+"). Waiting...")
						return;
					}

					// Call handler

					handler = this._handler(0);
					this.depID = this._callerOf(depID) || "0";
					handler(null,this._o);

				}
				else {

					// Finalizing a dependece or main code ?

					handler = this._handler(depID);
					this.depID = this._callerOf(depID) || "0";
					handler(null,null);

					// Remove dependence

					this._removedep(depID);

					// No more dependences ? Finalize everything!

					if ( this._deps <= 0 ) {
						handler = this._handler(0);
						handler(null,this._o);
					}
				}

			},
			_newdep: function(file,callerID,handler,args) {
				var
					depID = (++this._nextID).toString();

				this._deps++;
				this._files[depID] = file;
				this._handlers[depID] = handler;
				this._args[depID] = args;
				this._callers[depID] = callerID;

				return depID;
			},
			_removedep: function(id) {
				id = id.toString();
				if ( this._files[id] == null)
					return false;

				delete this._files[id];
				delete this._handlers[id];
				delete this._args[id];
				delete this._callers[id];
				this._deps--;
				return true;
			},
			_handler: function(id) {
				return this._handlers[id.toString()];
			},
			_callerOf: function(id) {
				return id ? this._callers[id.toString()] : null;
			}
		};

	// Now process the file, based on this new TTO

	return TT._processFile(tto,file,0,handler);

}

function _processFile(tto,file,depID,handler) {

	var
		TT = this,
		xfile = this.INCLUDE_PATH + "/" + file;

//	console.log("Processing template file: "+file);

	// Already on cache ?
/*
	if ( codeCache[file] != null ) {
//		console.log("Already on cache, not loading it again!");

		// Process

//		console.log("Running "+file+" with depID: "+depID);
		return TT._processCode(tto,codeCache[file],depID,handler);
	}
*/
	// Load template

//	console.log("Template not on cache, loading it");
	TT.loadTemplate(xfile,function(err,code){
		if ( err )
			return handler(err,null);

		// Cache it

		codeCache[file] = code;

		// Process

//		console.log("Running "+file+" with depID: "+depID);
		try {
			TT._processCode(tto,code,depID,handler);
		}
		catch(ex) {
			console.log("TT2: Template processing exception: ",ex);
		}
	});

}

function _processCode(tto,code,depID,handler) {

	var
		TT = this;

	tto.depID = depID;
	code.call(tto,tto,depID,handler);

}


// Escape text in a way that is safe to be used inside a quoted string

function _encodeText(str) {
	str = str.replace(/\r?\n/g,"\\n");
	str = str.replace(/'/g,'\\\'');
	return str;
}

// Merge objects

function _merge(dest,objs,overwrite) {

	objs.forEach(function(o){
		for ( var p in o ) {
			if ( overwrite || dest[p] == null )
				dest[p] = o[p];
		}
	});

	return dest;

}


// Export myself

exports.Template = function(opts){
	if ( opts == null )
		opts = { };

	// Defaults

	var
		defaultOpts = {
			INCLUDE_PATH: ".",
			enabledFeatures: null,
			FILTERS: {
				JSON: JSON.stringify
			}
		};

	// Options overwrite defaults

	_merge(this,[defaultOpts,opts],true);

	// Methods

	this.loadTemplate	= loadTemplate;
	this.convertTemplate	= convertTemplate;
	this.process		= process;
	this._processFile	= _processFile;
	this._processCode	= _processCode;
	this._encodeText	= _encodeText;
	this._convertXpr	= _convertXpr;
	this._convertAssingList	= _convertAssingList;
	this._convertQuotedStr	= _convertQuotedStr;
	this._convertDEFAULT	= _convertDEFAULT;
	this._convertGET	= _convertGET;
	this._convertSET	= _convertSET;
	this._convertINCLUDE	= _convertINCLUDE;
	this._convertCALL	= _convertCALL;
};
