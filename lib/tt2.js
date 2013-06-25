"use strict";

/*
 * TT2 - Javascript Pseudo-TemplateToolkit2 module
 *
 * TemplateToolkit2-alike processor
 *
 * Version: 0.0.2
 * Author:  David Oliveira <d.oliveira@prozone.org>
 */

 /*
   TODO:

   - Multiline (;) support
   - Keep variables state inside include
   - NOT, AND, OR operators - confirmar como funciona o NOT (se se aplica apenas à proxima expressao a todo o conjunto expressao)
   - BLOCK command support
   - PROCESS command support
   - INSERT command support
   - WRAPPER command support
   - SWITCH/CASE command support
   - WHILE command support
   - MACRO command support
   - TRY/THROW/CATCH/FINAL support
   - NEXT/LAST/RETURN/STOP/CLEAR support
   - Filtering
   - Ternary operator support
  */

 var
	fs		= require('fs'),
 	fileLastStat	= { },
 	codeCache	= { },
 	tagRx		= /^([\s\S]*?)\[%\s*(#?)([\s\S]+?)\s*(\-?)%\](\s*)/,
 	fnTagRx		= /^\s*(PROCESS|BLOCK|IF|UNLESS|ELSE|ELSIF|END|FOREACH|GET|CALL|SET|DEFAULT|INCLUDE)\s*((?:"[^"]*"|'[^']*'|[^;]+)*)(;?)\s*/,
 	xprRx		= /^\s*(\s*\()*\s*(?:"([^"]*)"|'([^']*)'|(\S+\s*\([^\)]*\)|[^\s\(\)]+))\s*(\s*\))*\s*/,
 	assignRx	= /^\s*([\w\.]+)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))\s*(?:#.*)?/,
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
				return handler(ex,null);
			}

			handler(null,binCode);
		});

	});

}

function convertTemplate(str,handler) {

//	console.log("Converting template");

	var
		TT = this,
		matched,
		code = "",
		aux = {
			deep: 0,
			indent: "  ",
			headerCode: "_tt2Fn = function(tto,depID,handler){\n",
			finishCode: "  return tto.finalize(depID);\n"
		},
		lastEntered = "";

	try {

		// Use regexp for getting content and expressions (special tags)

		do {
			matched = false;
			str = str.replace(tagRx,function(all,content,comment,tcode,opts,spaces){
				matched = true;

				// Comment ?

				if ( comment )
					return "";

				// Have content ?

				if ( content != "" )
					code += aux.indent+ "tto.print('"+_encodeText(content)+"');\n";

				// Is a function tag

				if ( tcode.match(fnTagRx) ) {
					var
						xprmatched,
						xprnum = 0;
					do {
						xprmatched = false;
						tcode = tcode.replace(fnTagRx,function(all,fn,args){
							xprmatched = true;

							// Conditions

							if ( TT.enabledFeatures == null || TT.enabledFeatures['CONDITIONS'] ) {
								if ( fn == "IF" ) {
									lastEntered = "if";
									code += aux.indent+'if ( '+_convertXpr(args)+" ) {\n";
									aux.indent += "  ";
								}
								else if ( fn == "UNLESS" ) {
									lastEntered = "if";
									code += aux.indent+'if (!( '+_convertXpr(args)+") ) {\n";
									aux.indent += "  ";
								}
								else if ( fn == "ELSIF" ) {
									lastEntered = "if";
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code += aux.indent+'}\n'+aux.indent+'else if ( '+_convertXpr(args)+" ) {\n";
									aux.indent += "  ";
								}
								else if ( fn == "ELSE" ) {
									lastEntered = "if";
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code += aux.indent+'}\n'+aux.indent+'else {\n';
									aux.indent += "  ";
								}
								else if ( fn == "END" && lastEntered == "if" ) {
									lastEntered = "if";
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code += aux.indent+"}\n";
								}
							}
							else if ( !TT.enabledFeatures['CONDITIONS'] ) {
								if ( fn == "END" ) {
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code += aux.indent+"}\n";
								}
								else if ( fn.match(/^(IF|ELSIF|ELSE|UNLESS)$/i) ) {
									code += aux.indent+"if ( 0 ) {\n";
									aux.indent += "  ";
								}
							}

							// Blocks

							if ( TT.enabledFeatures == null || TT.enabledFeatures['BLOCKS'] ) {
								if ( fn.match(/BLOCK/i) ) {

									if ( !args.match(/^\w+$/) )
										throw new Exception("BLOCK directive needs a name");

									aux.headerCode += aux.indent+"var _tto_block_"+args+" = function(){\n";
									aux.indent += "  ";
									lastEntered = "block";

								}
								else if ( fn.match(/^END$/i) && lastEntered == "block" ) {
									aux.indent = aux.indent.substr(0,aux.indent.length-2);
									code += aux.indent+"};\n";
								}
							}

							// Other functions

							if ( (TT.enabledFeatures == null || TT.enabledFeatures[fn]) && fnConvTable[fn] != null ) {
								var fnCode = fnConvTable[fn](args,aux);
								if ( fnCode != null && fnCode != "" )
									code += fnCode;
							}

							return "";
						});

					} while ( xprmatched );

				}

				// Is a SET without SET ? (assignment)

				else if ( tcode.match(assignRx) ) {
					while ( tcode.match(assignRx) ) {
						code += _convertSET(tcode,aux);
						tcode = tcode.replace(assignRx,"");
					}
				}

				// So is a GET without GET (expression return)

				else {
					code += aux.indent+"tto.print("+_convertXpr(tcode)+");\n";
				}

				// Spaces or not spaces

				if ( opts == "-" )
					spaces = spaces.replace(/^\n/,"");
				if ( spaces.length > 0 )
					code += aux.indent+"tto.print('"+_encodeText(spaces)+"');\n";

				return "";
			});

		} while ( matched );

	}
	catch(ex) {
		// Aborted for some reason ?
		throw ex;
		return handler(ex,null);
	}


	// Last text

	str = str.replace(/^([\s\S]+?)$/,function(a,b){
		code += aux.indent+'tto.print(\''+_encodeText(b)+"');\n";
		return "";
	});

	// Function finish

	code = aux.headerCode + code + aux.finishCode+"}\n";

	// If nothing is pending, call the handler!

	console.log("CODE: ",code);
	handler(null,code);

}

function _convertXpr(xpr) {

	var
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
				parts.push(_convertQuotedStr(str1));
			else if ( str2 != null )
				parts.push("\'"+str2+"\'");
			else if ( el.match(/^not$/i) || el == "!" ) {
				parts.push("!(");
				ecpars += ")";
			}
			else if ( el.match(/and/i) )
				parts.push("&&");
			else if ( el.match(/or/i) )
				parts.push("||");
			else if ( el == "=" )
				parts.push("==");
			else if ( el == "_" )
				parts.push("+");
			else if ( el.match(/^\d/) )
				parts.push(el);
			else if ( el.match(/^([a-zA-Z\.]+)\s*\((.*)\)\s*$/) )
				parts.push("tto.getvar('"+RegExp.$1+"').apply(tto,["+RegExp.$2+"])");
			else if ( el.match(/^[a-zA-Z\.]+/) )
				parts.push("tto.getvar('"+_encodeText(el)+"')");
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

	return ("\""+str.replace(/\$(\w+)/g,function(a,b){
		return "\"+tto.getvar('"+_encodeText(b)+"\')+\"";
	})+"\"").replace(/^\"\"\+|\+\"\"$/g,"");

}

function _convertAssingList(xprs) {

	var
		matched,
		obj = "{";

	do {
		matched = false;
		xprs = xprs.replace(assignRx,function(all,prop,val){
			matched = true;
			obj += "\'"+_encodeText(prop)+"\': "+_convertXpr(val)+", ";
			return "";
		});
	} while ( matched );

	if ( obj.length > 3 )
		obj = obj.substr(0,obj.length-2);

	return obj+"}";

}

function _convertGET(args,aux) {

	if ( args == null || args.match(/^\s*$/) )
		throw new Error("GET directive syntax error");

	return aux.indent+"tto.print(" +_convertXpr(args)+ ");\n";

}

function _convertCALL(args,aux) {

	if ( args == null || args.match(/^\s*$/) )
		throw new Error("CALL directive syntax error");

	return aux.indent+_convertXpr(args)+";\n";

}

function _convertSET(args,aux) {

	var
		code = "";

	while ( args.match(assignRx) ) {
		code += aux.indent+"tto.setvar('" +_encodeText(RegExp.$1)+ "'," +_convertXpr(RegExp.$2) +");\n";
		args = args.replace(assignRx,"");
	}

	return code;

}

function _convertDEFAULT(args,aux) {

	var
		code = "";

	while ( args.match(assignRx) ) {
		code += aux.indent+"tto.setvar('" +_encodeText(RegExp.$1)+ "'," +_convertXpr(RegExp.$2) +",true);\n";
		args = args.replace(assignRx,"");
	}

	return code;

}

function _convertINCLUDE(args,aux) {

	var
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
		incArgs = _convertAssingList(args);

	aux.finishCode = "  "+aux.finishCode.replace(/\n/g,"\n  ")+aux.indent.substr(0,aux.indent-2)+"});\n";

	code = aux.indent+"return tto.include('"+_encodeText(file)+"',"+incArgs+",function(err){\n";
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
			_o:		"",			// Output buffer

			_deep:		0,
			_deps:		0,			// Number of dependences
			_aborted:	false,			// If aborted during closure execution

			// Methods:

			print: function(v) {
				this._o += v;
			},
			getvar: function(name) {
				var
					scopedArgs = this._args[this.depID];

				return this._getvar(scopedArgs,name) || this._getvar(this.data,name) || this._getvar(this.defaults,name) || "";
			},
			_getvar: function(o,name) {
				var
					parts = name.split("."),
					part;

				while ( parts.length && (part = parts.shift()) != null ) {
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

				// Not so deep
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
					depID = (++this._deps).toString();

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

	if ( codeCache[file] != null ) {
//		console.log("Already on cache, not loading it again!");

		// Process

		console.log("Running "+file+" with depID: "+depID);
		return TT._processCode(tto,codeCache[file],depID,handler);
	}

	// Load template

//	console.log("Template not on cache, loading it");
	TT.loadTemplate(xfile,function(err,code){
		if ( err )
			return handler(err,null);

		// Cache it

		codeCache[file] = code;

		// Process

//		console.log("Running "+file+" with depID: "+depID);
		TT._processCode(tto,code,depID,handler)
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
			enabledFeatures: null
		};

	// Options overwrite defaults

	_merge(this,[defaultOpts,opts],true);

	// Methods

	this.loadTemplate	= loadTemplate;
	this.convertTemplate	= convertTemplate;
	this.process		= process;
	this._processFile	= _processFile;
	this._processCode	= _processCode;
};
