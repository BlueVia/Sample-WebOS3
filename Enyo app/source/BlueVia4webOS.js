/*
Copyright 2010 Andres Leonardo Martinez Ortiz

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
	name: "MyApps.BlueVia4webOS",
	kind: enyo.VFlexBox,
	components: [
		{kind: "PageHeader", components: [
			{kind: enyo.VFlexBox, content: "BlueVia for Enyo", flex: 1},
			{name: "backButton", kind: "Button", content: "Back", onclick: "goBack"}
		]},
		{name: "bluevialib", className: "enyo-bg", kind: "MyApps.BlueViaLib"
		},
		{name: "pane", kind: "Pane", flex: 1, onSelectView: "viewSelected",
			components: [
				{name: "services", className: "enyo-bg", kind: "Scroller", 
					components: [
						{kind: "HFlexBox", className: "enyo-row", align: "center", components: [
							{content: "Sandbox", domStyles: {padding: "8px"}}, 
							{name: "sandbox", kind: "ToggleButton", onChange: "btnSandbox"}
						]},
						{kind: "RowGroup", name: "sendSMS", caption: "Send SMS", components: [
							{name: "msisdn", kind: "Input", hint: "MSISDN(s) comma separated (Format UK: 44 778 111111)"},
							{name: "msg",    kind: "Input", hint: "SMS Message"},
							{                kind: "Button", style: "width: 60%; margin:auto;",       caption: "Send", onclick: "btnSend"}
						]},
						{kind: "RowGroup", name:"trackSMS", caption: "Track SMS", components: [
							{name: "notification", content: "Not sent", style: "text-align:center;"},
							{                      kind: "Button", style: "width: 60%; margin:auto;", caption: "Track", onclick: "btnTrack"}
						]},
						{kind: "RowGroup", name:"locate", caption: "Locate Terminal", components: [
							{name: "location", content: "Not located", style: "text-align:center;"},
							{name: "accuracy", kind: "Input", hint: "Expected accuracy in meters - keep empty if not needed"},
							{                  kind: "Button", style: "width: 60%; margin:auto;",   caption: "Locate", onclick: "btnLocate"}
						]},
						{kind: "RowGroup", name:"getUserContext", caption: "User Context", components: [
							{name: "userContext", content: "No info", style: "text-align:center;"},
							{                     kind: "Button", style: "width: 60%; margin:auto;",   caption: "User Info", onclick: "btnUserContext"}
						]},
					]
				},
				{name: "authorize", className: "enyo-bg", kind: "Scroller", 
					components: [
						{content: "</br><h1>Authorization necessary</h1> The application uses paid BlueVia Services. </br>Please press the <em>Authorize</em> button.",
							style: "text-align:center;"
						},
						{kind: "Button", style: "width: 50%; margin:auto; margin-top:25px;", caption: "Authorize", onclick: "btnAuth"},
					]
				},
				{name: "oauth", className: "enyo-bg", kind: "Scroller",
				 	components: [
						{name: "webView", kind: "WebView", className: "enyo-view"}
				 	]
				}
			]
		}
	],
	// = = = = = = = = = = = = = = = = 
	// Constructor
	// = = = = = = = = = = = = = = = = 
	create: function() {
		this.inherited(arguments);

		// load and set accessToken here, e.g.
		// 		token = < loadAccessToken() >
		// 		this.$.bluevialib.setAccessToken(token[0], token[1]); 
		// else authentication will happen
		
		// this.$.bluevialib.setAccessToken("accessToken", "accessTokenSecret"); 
		
		// turn sandbox on
		this.setSandbox(true);
		
		this.selectView();
		this.$.backButton.hide();		
		
		thisObj = this; // for callbacks
	},
		
	// = = = = = = = = = = = = = = = = 
	// toggle sandbox
	// = = = = = = = = = = = = = = = = 
	btnSandbox: function(inSender, inState) {
		this.setSandbox(inState);
	},
	
	setSandbox: function(state) {
		this.$.sandbox.setState(state);
		this.$.bluevialib.setSandbox(state);				
	},

	// = = = = = = = = = = = = = = = = 
	// Authorize
	// = = = = = = = = = = = = = = = = 
	btnAuth: function() {
		this.$.pane.selectViewByName("oauth");
		this.$.backButton.show();
		this.$.bluevialib.authorize(this.$.webView, this.authCallback);
	},
	
	authCallback: function(status) {
		enyo.log("Authorization result: " + enyo.json.stringify(status));
		enyo.log("Here you should save the access token fur future use");
	},
	
	// = = = = = = = = = = = = = = = = 
	// send SMS
	// = = = = = = = = = = = = = = = = 
	btnSend: function() {
		var tmp = thisObj.$.msisdn.value.replace(" ", "");
		var msisdns = (tmp.length==0) ? [] : tmp.split(",");
		var msg = thisObj.$.msg.value;

		if (msisdns.length > 0 && msg.length > 0 ) {
			this.SmsId = this.$.bluevialib.sendSMS(msisdns, msg, this.sendCallback);
		} else {
			thisObj.$.notification.setContent("ERROR: empty inputs");
		}
	},
	
	sendCallback: function(smsId, status) {
		enyo.log("Send SMS: " + smsId + " = " + enyo.json.stringify(status))
		thisObj.$.notification.setContent(enyo.json.stringify(status));
	},
	
	// = = = = = = = = = = = = = = = = 
	// track SMS
	// = = = = = = = = = = = = = = = = 
	btnTrack: function() {
		this.$.bluevialib.trackSms(this.SmsId, this.trackCallback)
	},
	
	trackCallback: function(smsId, status) {
		enyo.log("Track SMS: " + smsId + " = " + enyo.json.stringify(status))
		thisObj.$.notification.setContent(enyo.json.stringify(status));
	},
	
	// = = = = = = = = = = = = = = = = 
	// locate
	// = = = = = = = = = = = = = = = = 
	btnLocate: function() {
		var accuracy = (thisObj.$.accuracy.value == "") ? null : thisObj.$.accuracy.value;
		this.$.bluevialib.locateTerminal(accuracy, this.locateCallback);
	},
	
	locateCallback: function(loc) {
		enyo.log("locate: " + loc);
		thisObj.$.location.setContent(enyo.json.stringify(loc));
	},
	
	// = = = = = = = = = = = = = = = = 
	// user context
	// = = = = = = = = = = = = = = = = 
	btnUserContext: function() {
		var type = ""; // "" = all, else: "UserPersonalInfo", "UserProfile", "UserAccessInfo", "PersonalInfo", "UserInfo" 
		this.$.bluevialib.getUserContext(type, this.userContextCallback)
	},
	
	userContextCallback: function(info) {
		enyo.log("userContext: " + info);
		thisObj.$.userContext.setContent(enyo.json.stringify(info));
	},

	// = = = = = = = = = = = = = = = = 
	// Helpers
	// = = = = = = = = = = = = = = = = 
	goBack: function(inSender, inEvent) {
		this.$.pane.back(inEvent);
		this.selectView();
		this.$.backButton.hide();
		this.$.webView.setUrl("about:blank");
	},
	
	selectView: function() {
		if(this.$.bluevialib.isAuthorized()) {
			this.$.pane.selectViewByName("services");
		} else {
			this.$.pane.selectViewByName("authorize");
		}
	},
});