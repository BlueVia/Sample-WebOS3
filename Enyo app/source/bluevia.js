/*
Copyright 2011 Bernhard Walter

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
enyo.kind({
	name: "MyApps.BlueViaLib",
	kind: enyo.VFlexBox,
	components: [
		{kind: "Dialog", components: [
			{content: "Authentication successfull finished and the verification code has already been added.</br>If you want to go back to the application, press the \"Back\" button in the page header.", 
				style: "text-align:center"},
			{layoutKind: "HFlexLayout", pack: "center", components: [{kind: "Button", caption: "OK", onclick: "confirmInfo" }]}
		]},		
		{name: "getRequestToken", kind: "WebService", 
			onSuccess: "gotRequestToken",
			onFailure: "failure"
		},
		{name: "getAccessToken", kind: "WebService", 
			onSuccess: "gotAccessToken",
			onFailure: "failure"
		},
		{name: "sendSMS", kind: "WebService",
			onSuccess: "sentSMS",
			onFailure: "failure"
		},
		{name: "trackSMS", kind: "WebService",
			onSuccess: "trackedSMS",
			onFailure: "failure"
		},
		{name: "locateTerminal", kind: "WebService", 
			onSuccess: "locatedTermial",
			onFailure: "failure"
		},
		{name: "getUserContext", kind: "WebService",
			onSuccess: "gotUserContext",
			onFailure: "failure"
		},
		{name: "getAds", kind: "WebService",
			onSuccess: "gotAds",
			onFailure: "failure"
		},
	],

	// = = = = = = = = = = = = = = = = 
	// Constructor
	// = = = = = = = = = = = = = = = = 
	create: function() {
		this.inherited(arguments);

		requestTokenURL      = "https://api.bluevia.com/services/REST/Oauth/getRequestToken";
		userAuthorizationURL = "https://connect.bluevia.com/#lang#/authorise";
		accessTokenURL       = "https://api.bluevia.com/services/REST/Oauth/getAccessToken";
		smsOutboundURL       = "https://api.bluevia.com/services/REST/SMS#env#/outbound/requests";
		locationURL	         = "https://api.bluevia.com/services/REST/Location#env#/TerminalLocation";
		userContextURL       = "https://api.bluevia.com/services/REST/Directory#env#/alias:#token#/UserInfo"
		advertisingURL		 = "https://api.bluevia.com/services/REST/Advertising#env#/simple/requests"

	    this.consumerSecret  = BlueViaConfig.consumerSecret;
	    this.consumerKey     = BlueViaConfig.consumerKey;
		this.language        = "en";

	    this.verifier           = null;
	    this.requestToken       = null;
	    this.requestTokenSecret = null;
    	this.accessToken        = null;
    	this.accessTokenSecret  = null;
		
	    this.accessor = {
	        consumerSecret: this.consumerSecret,
	        tokenSecret: ''
	    };
		this.sandbox = "_Sandbox";
		this.apiVersion = "v1";
		this.webView = null;
		this.deliveryNotifications = {};
	},

	// = = = = = = = = = = = = = = = = 
	// Helpers
	// = = = = = = = = = = = = = = = = 
	confirmInfo: function() {
		this.$.dialog.close();
	},
	
	getUid: function() {
		var d = new Date();
		return "" + d.getTime() + "-" + Math.round(Math.random()*1000000);
	},

	createMessage: function(pUrl) {
		var message = {
            action: pUrl,
            method: 'POST',
            parameters: []
        };
        message.parameters.push(['oauth_consumer_key', this.consumerKey]);
        message.parameters.push(['oauth_signature_method', "HMAC-SHA1"]);
        return message;
    },	
	
	setAccessToken: function(accessToken, accessTokenSecret) {
		this.accessToken = accessToken;
		this.accessTokenSecret = accessTokenSecret;
	},
	
	setSandbox: function(value) {
		this.sandbox = (value) ? "_Sandbox" : "";
	},
	
	httpCall: function(service, uid, callback, method, url, body, message, contentType) {
		// sign the call
		OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message, this.accessor);
		var headers = {"Authorization":OAuth.getAuthorizationHeader("", message.parameters)}

		// set the http parameters ...
		service.setUrl(url);
		service.setMethod(method);
		service.setHeaders(headers);
		service.setContentType(contentType);

		// ... and the internal parameters
		service.cb = callback;    // call back to the view
		service.uid = uid;        // for SMS Notifications
		service.by = this;        // allows callbacks to access object
		
		// execute the call
		service.call(body);
	},

	failure: function(inSender, inResponse, inRequest) {
		enyo.log("Got failure from " + inSender.name);
		enyo.log(inResponse);
		if(inSender.uid != "")
			inSender.cb(inSender.uid, inResponse);			
		else
			inSender.cb(inResponse);			
	},

	// = = = = = = = = = = = = = = = = 
	// Driver for authorization
	// = = = = = = = = = = = = = = = = 

	authorize: function(pWebView, callback) {
		this.webView = pWebView;
		var that = this;
		this.webView.node.onload = function() { 
			var classname = this.contentDocument.body.className;
			var parts = classname.split("-");
			if (parts[0] == "authorise" && parts[1] == "success") {  // !!! Critical: use of internal structure of result site !!! 
				// enyo.log("Verifier: " + parts[3]);
				that.verifier = parts[3];
				that.getAccessToken(callback);
			}
		}
		this.getRequestToken(callback);
	},

	isAuthorized: function() {
		return this.accessToken != null && this.accessTokenSecret != null;
	},

	// = = = = = = = = = = = = = = = = 
	// Request Token
	// = = = = = = = = = = = = = = = = 
	getRequestToken: function(callback) {
        this.accessor.tokenSecret = '';

        var message = this.createMessage(requestTokenURL);
        message.parameters.push(["oauth_callback","oob"]);

		this.httpCall(this.$.getRequestToken, null, callback, "POST", requestTokenURL, "", message);
	},

	gotRequestToken: function(inSender, inResponse, inRequest) {
        var responseParams = OAuth.getParameterMap(inResponse);
        this.requestToken = responseParams['oauth_token'];
        this.requestTokenSecret = responseParams['oauth_token_secret'];
		// enyo.log("Success Request Token:" + this.requestToken + " = " + this.requestTokenSecret);

		var url = userAuthorizationURL.replace("#lang#", this.language) + "?oauth_token=" + this.requestToken;
		// enyo.log("User Authorization URL: " + url);
		this.webView.setUrl(url);
	},

	// = = = = = = = = = = = = = = = = 
	// Access Token
	// = = = = = = = = = = = = = = = = 
	getAccessToken: function(callback) {
        this.accessor.tokenSecret = this.requestTokenSecret;

        var message = this.createMessage(accessTokenURL);
        message.parameters.push(['oauth_token', this.requestToken]);
        message.parameters.push(['oauth_verifier', this.verifier]);

		this.httpCall(this.$.getAccessToken, null, callback, "POST", accessTokenURL, "", message);
	},

	gotAccessToken: function(inSender, inResponse) {
        var responseParams = OAuth.getParameterMap(inResponse);
        this.accessToken = responseParams['oauth_token'];
        this.accessTokenSecret = responseParams['oauth_token_secret'];
		// enyo.log("Success Access Token: " + this.accessToken + " = " + this.accessTokenSecret);

		this.$.dialog.open();
		inSender.cb(responseParams);
	},

	// = = = = = = = = = = = = = = = = 
	// Generic BlueVia oAuth calls
	// = = = = = = = = = = = = = = = = 
    sendCall: function(caller, uid, callback, method, pUrl, pParameters, body, contentType) {
        if (this.accessToken == null || this.accessTokenSecret == null) {
            enyo.log('Client doesn\'t have an access token.');
            return false;
        }

        this.accessor.tokenSecret = this.accessTokenSecret;
		
		var url = pUrl + "?version=" + this.apiVersion;
        var message = this.createMessage(pUrl);
        message.method = method;
        message.parameters.push(['oauth_token', this.accessToken]);
        message.parameters.push(["version", this.apiVersion]);

		for (p in pParameters) {
			message.parameters.push(pParameters[p]);
			if(contentType != "application/x-www-form-urlencoded")
				url += "&" + pParameters[p][0] + "=" + pParameters[p][1];
		}
		
		this.httpCall(caller, uid, callback, method, url, body, message, contentType);
    },

	// = = = = = = = = = = = = = = = = 
	// BlueVia send SMS
	// = = = = = = = = = = = = = = = = 
	sendSMS: function(msisdns, message, callback) {
		var recipients = [];
		for (m in msisdns) recipients.push({"phoneNumber":msisdns[m]})
		var body = {"smsText": {"address": recipients, "message":message, "originAddress": {"alias": this.accessToken}}};
		var uid = this.getUid();
		this.deliveryNotifications[uid] = "ND"; // flag SMS as Not Delivered

		this.sendCall(this.$.sendSMS, uid, callback, "POST", smsOutboundURL.replace("#env#", this.sandbox), [], enyo.json.stringify(body), "application/json");
		return uid;
	},

	sentSMS: function(inSender, inResponse, inRequest) {
		// enyo.log(inSender.uid + ": " + inRequest.xhr.getResponseHeader("Location"));
		inSender.by.deliveryNotifications[inSender.uid] = inRequest.xhr.getResponseHeader("Location");
		inSender.cb(inSender.uid, "Successfully sent");
	},

	// = = = = = = = = = = = = = = = = 
	// BlueVia track SMS (dlivery notification)
	// = = = = = = = = = = = = = = = = 
	trackSms: function(smsId, callback) {
		result = this.sendCall(this.$.trackSMS, smsId, callback, "GET", this.deliveryNotifications[smsId], [], "", "application/json");	
		return true;
	},

	trackedSMS: function(inSender, inResponse, inRequest) {
		// enyo.log(inResponse);
		var tmp = inResponse.smsDeliveryStatus.smsDeliveryStatus[0];
		inSender.cb(inSender.uid, inResponse);
		// enyo.log(tmp.address.phoneNumber + " : " + tmp.deliveryStatus);		
	}, 

	// = = = = = = = = = = = = = = = = 
	// BlueVia locate Terminal
	// = = = = = = = = = = = = = = = = 
	locateTerminal: function(accuracy, callback) {
		var parameters = [["alt","json"],["version",this.apiVersion],["locatedParty","alias:" + this.accessToken]];
		if(accuracy)
			parameters.push(["acceptableAccuracy", accuracy.toString()]);

		result = this.sendCall(this.$.locateTerminal, "", callback, "GET", locationURL.replace("#env#", this.sandbox), parameters, "", "application/json");	
		return true;
	},

	locatedTerminal: function(inSender, inResponse, inRequest) {
		var tmp = inResponse.smsDeliveryStatus.smsDeliveryStatus[0];
		inSender.cb(tmp.deliveryStatus);
	},	

	// = = = = = = = = = = = = = = = = 
	// BlueVia User Context
	// = = = = = = = = = = = = = = = = 
	getUserContext: function(type, callback) {
		if(type != "") type = "/" + type;
		var url = userContextURL.replace("#env#", this.sandbox).replace("#token#", this.accessToken) + type;
		result = this.sendCall(this.$.getUserContext, "", callback, "GET", url, [["alt","json"]], "", "application/json");	
		return true;
	},
	gotUserContext: function(inSender, inResponse, inRequest) {
		// enyo.log(inResponse);
		inSender.cb(inResponse);
	},	

	// = = = = = = = = = = = = = = = = 
	// BlueVia Advertising
	// = = = = = = = = = = = = = = = = 
	getAds3: function(type, userAgent, keywords, protectionPolicy, callback) { // 3 legged advertising API
		var adType = (type == "image") ? "0101" : "0104";
		var parameters = [["ad_request_id", this.getUid()], ["ad_representation", adType], ["ad_space", BlueViaConfig.adSpaceId], ["user_agent", userAgent]];
		if (keywords)
			parameters.push(["keywords", keywords.join("|")]);
		if (protectionPolicy)
			parameters.push(["protection_policy", protectionPolicy]);
		var url = advertisingURL.replace("#env#", this.sandbox);

		result = this.sendCall(this.$.getAds, "", callback, "POST", url, parameters, OAuth.formEncode(parameters), "application/x-www-form-urlencoded");	
		return true;
	},
	gotAds: function(inSender, inResponse, inRequest) {
		var parser = new DOMParser();
		xmlDoc = parser.parseFromString (inResponse, "text/xml");
		var adId = xmlDoc.getElementsByTagName ("ad")[0].attributes.getNamedItem("id").value;
		var adPl = xmlDoc.getElementsByTagName ("ad")[0].attributes.getNamedItem("ad_placement").value;
		var adCa = xmlDoc.getElementsByTagName ("ad")[0].attributes.getNamedItem("campaign").value;
		var adFl = xmlDoc.getElementsByTagName ("ad")[0].attributes.getNamedItem("flight").value;
		var adRp = xmlDoc.getElementsByTagName ("resource")[0].attributes.getNamedItem("ad_presentation").value;
		var ceTp = xmlDoc.getElementsByTagName ("creative_element")[0].attributes.getNamedItem("type").value;
		var ceIn = xmlDoc.getElementsByTagName ("interaction")[0].attributes.getNamedItem("type").value;
		var ceLo = xmlDoc.getElementsByTagName ("attribute")[0].childNodes[0].nodeValue;
		var ceLT = xmlDoc.getElementsByTagName ("attribute")[0].attributes.getNamedItem("type").value;
		var ceUr = xmlDoc.getElementsByTagName ("attribute")[1].childNodes[0].nodeValue;
		var ceUT = xmlDoc.getElementsByTagName ("attribute")[1].attributes.getNamedItem("type").value;
		
		var result = {"ad": {"id":adId, 
		                     "ad_place_ment":adPl, 
							 "campaign":adCa, 
							 "flight":adFl, 
		                     "resource":{"ad_representation":adRp, 
		                                 "creative_element":{"type":ceTp,
		                                                     "attribute":{"type": ceLT, "value":ceLo},
															 "interaction":{"type":ceIn, "attribute":{"type":ceUT, "value":ceUr}}}}}}					 
		inSender.cb(result);
	}	
});