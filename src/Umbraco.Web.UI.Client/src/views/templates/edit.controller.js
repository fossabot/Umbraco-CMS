(function () {
    "use strict";

    function TemplatesEditController($scope, $routeParams, templateResource, assetsService, notificationsService, editorState, navigationService, appState, macroService, treeService, angularHelper, $timeout) {

        var vm = this;
        var oldMasterTemplateAlias = null;

        vm.page = {};
        vm.page.loading = true;
        vm.templates = [];

        //menu
        vm.page.menu = {};
        vm.page.menu.currentSection = appState.getSectionState("currentSection");
        vm.page.menu.currentNode = null;
        
        vm.save = function () {
            vm.page.saveButtonState = "busy";

            vm.template.content = vm.editor.getValue();

            templateResource.save(vm.template).then(function (saved) {
                
                notificationsService.success("Template saved");
                vm.page.saveButtonState = "success";
                vm.template = saved;

                //sync state
                editorState.set(vm.template);
                
                // sync tree
                // if master template alias has changed move the node to it's new location
                if(oldMasterTemplateAlias !== vm.template.masterTemplateAlias) {

                    // move node to new location in tree
                    //first we need to remove the node that we're working on
                    treeService.removeNode(vm.page.menu.currentNode);
                    
                    // update stored alias to the new one so the node won't move again unless the alias is changed again
                    oldMasterTemplateAlias = vm.template.masterTemplateAlias;

                    navigationService.syncTree({ tree: "templates", path: vm.template.path, forceReload: true, activate: true }).then(function (args) {
                        vm.page.menu.currentNode = args.node;
                    });

                } else {

                    // normal tree sync
                    navigationService.syncTree({ tree: "templates", path: vm.template.path, forceReload: true }).then(function (syncArgs) {
                        vm.page.menu.currentNode = syncArgs.node;
                    });

                }

                // clear $dirty state on form
                setFormState("pristine");


            }, function (err) {
                notificationsService.error("Template save failed");
                vm.page.saveButtonState = "error";
            });
        };

        vm.init = function () {

            //we need to load this somewhere, for now its here.
            assetsService.loadCss("lib/ace-razor-mode/theme/razor_chrome.css");

            //load templates - used in the master template picker
            templateResource.getAll()
                .then(function(templates) {
                    vm.templates = templates;
                });

            if($routeParams.create){

            	templateResource.getScaffold().then(function(template){
            		vm.ready(template);
            	});

            }else{

            	templateResource.getById($routeParams.id).then(function(template){
                    vm.ready(template);
                });

            }

        };


        vm.ready = function(template){
        	vm.page.loading = false;
            vm.template = template;

            //sync state
            editorState.set(vm.template);
            navigationService.syncTree({ tree: "templates", path: vm.template.path, forceReload: true }).then(function (syncArgs) {
                vm.page.menu.currentNode = syncArgs.node;
            });

            // save state of master template to use for comparison when syncing the tree on save
            oldMasterTemplateAlias = angular.copy(template.masterTemplateAlias);

            // ace configuration
            vm.aceOption = {
                mode: "razor",
                theme: "chrome",
                showPrintMargin: false,
                advanced: {
                    fontSize: '14px'
                },
                onLoad: function(_editor) {
                    vm.editor = _editor;
                    
                    // initial cursor placement
                    // Keep cursor in name field if we are create a new template
                    // else set the cursor at the bottom of the code editor
                    if(!$routeParams.create) {
                        $timeout(function(){
                            vm.editor.navigateFileEnd();
                            vm.editor.focus();
                            persistCurrentLocation();
                        });
                    }

                    //change on blur, focus
                    vm.editor.on("blur", persistCurrentLocation);
                    vm.editor.on("focus", persistCurrentLocation);
            	}
            }
            
        };

        vm.openPageFieldOverlay = openPageFieldOverlay;
        vm.openDictionaryItemOverlay = openDictionaryItemOverlay;
        vm.openQueryBuilderOverlay = openQueryBuilderOverlay;
        vm.openMacroOverlay = openMacroOverlay;
        vm.openInsertOverlay = openInsertOverlay;
        vm.openSectionsOverlay = openSectionsOverlay;
        vm.openPartialOverlay = openPartialOverlay;
        vm.openMasterTemplateOverlay = openMasterTemplateOverlay;
        vm.selectMasterTemplate = selectMasterTemplate;
        vm.getMasterTemplateName = getMasterTemplateName;
        vm.removeMasterTemplate = removeMasterTemplate;

        function openInsertOverlay() {

            vm.insertOverlay = {
                view: "insert",
                hideSubmitButton: true,
                show: true,
                submit: function(model) {

                    switch(model.insert.type) {
                        case "macro":

                            var macroObject = macroService.collectValueData(model.insert.selectedMacro, model.insert.macroParams, "Mvc");
                            insert(macroObject.syntax);
                            break;

                        case "dictionary":
                            //crappy hack due to dictionary items not in umbracoNode table
                        	var code = "@Umbraco.GetDictionaryValue(\"" + model.insert.node.name + "\")";
                        	insert(code);
                            break;

                        case "partial":
                            //crappy hack due to dictionary items not in umbracoNode table
                            var code = "@Html.Partial(\"" + model.insert.node.name + "\")";
                            insert(code);
                            break;
                            
                        case "umbracoField":
                            insert(model.insert.umbracoField);
                            break;
                    }

                    vm.insertOverlay.show = false;
                    vm.insertOverlay = null;

                },
                close: function(oldModel) {
                    // close the dialog
                    vm.insertOverlay.show = false;
                    vm.insertOverlay = null;
                    // focus editor
                    vm.editor.focus();
                }
            };

        }


        function openMacroOverlay() {

            vm.macroPickerOverlay = {
                view: "macropicker",
                dialogData: {},
                show: true,
                title: "Insert macro",
                submit: function (model) {

                    var macroObject = macroService.collectValueData(model.selectedMacro, model.macroParams, "Mvc");
                    insert(macroObject.syntax);

                    vm.macroPickerOverlay.show = false;
                    vm.macroPickerOverlay = null;

                },
                close: function(oldModel) {
                    // close the dialog
                    vm.macroPickerOverlay.show = false;
                    vm.macroPickerOverlay = null;
                    // focus editor
                    vm.editor.focus();
                }
            };
        }


        function openPageFieldOverlay() {
            vm.pageFieldOverlay = {
                submitButtonLabel: "Insert",
                closeButtonlabel: "Cancel",
                view: "insertfield",
                show: true,
                submit: function (model) {
                    insert(model.umbracoField);
                    vm.pageFieldOverlay.show = false;
                    vm.pageFieldOverlay = null;
                },
                close: function (model) {
                    // close the dialog
                    vm.pageFieldOverlay.show = false;
                    vm.pageFieldOverlay = null;
                    // focus editor
                    vm.editor.focus();                    
                }
            };
        }


        function openDictionaryItemOverlay() {
            vm.dictionaryItemOverlay = {
                view: "treepicker",
                section: "settings",
                treeAlias: "dictionary",
                entityType: "dictionary",
                multiPicker: false,
                show: true,
                title: "Insert dictionary item",
                select: function(node){
                	//crappy hack due to dictionary items not in umbracoNode table
                	var code = "@Umbraco.GetDictionaryValue(\"" + node.name + "\")";
                	insert(code);

                	vm.dictionaryItemOverlay.show = false;
                    vm.dictionaryItemOverlay = null;
                },
                close: function (model) {
                    // close dialog
                    vm.dictionaryItemOverlay.show = false;
                    vm.dictionaryItemOverlay = null;
                    // focus editor
                    vm.editor.focus();
                }
            };
        }

        function openPartialOverlay() {
            vm.partialItemOverlay = {
                view: "treepicker",
                section: "settings", 
                treeAlias: "partialViews",
                entityType: "partialView",
                multiPicker: false,
                show: true,
                title: "Insert Partial view",
                select: function(node){
                    //crappy hack due to dictionary items not in umbracoNode table
                    var code = "@Html.Partial(\"" + node.name + "\")";
                    insert(code);

                    vm.partialItemOverlay.show = false;
                    vm.partialItemOverlay = null;
                },
                close: function (model) {
                    // close dialog
                    vm.partialItemOverlay.show = false;
                    vm.partialItemOverlay = null;
                    // focus editor
                    vm.editor.focus();
                }
            };
        }

        function openQueryBuilderOverlay() {
            vm.queryBuilderOverlay = {
                view: "querybuilder",
                show: true,
                title: "Query for content",

                submit: function (model) {

                    var code = "\n@{\n" + "\tvar selection = " + model.result.queryExpression + ";\n}\n";
                    code += "<ul>\n" +
                                "\t@foreach(var item in selection){\n" +
                                    "\t\t<li>\n" +
                                        "\t\t\t<a href=\"@item.Url\">@item.Name</a>\n" +
                                    "\t\t</li>\n" +
                                "\t}\n" +
                            "</ul>\n\n";

                    insert(code);
                    
                    vm.queryBuilderOverlay.show = false;
                    vm.queryBuilderOverlay = null;
                },

                close: function (model) {
                    // close dialog
                    vm.queryBuilderOverlay.show = false;
                    vm.queryBuilderOverlay = null;
                    // focus editor
                    vm.editor.focus();   
                }
            };
        }


        function openSectionsOverlay() {

            vm.sectionsOverlay = {
                view: "templatesections",
                hasMaster: vm.template.masterTemplateAlias,
                submitButtonLabel: "Insert",
                show: true,
                submit: function(model) {

                    if (model.insertType === 'renderBody') {
                        insert("@RenderBody()");
                    }

                    if (model.insertType === 'renderSection') {
                        insert("@RenderSection(\"" + model.renderSectionName + "\", " + model.mandatoryRenderSection + ")");
                    }

                    if (model.insertType === 'addSection') {
                        wrap("@section " + model.sectionName + "\r\n{\r\n\r\n\t{0}\r\n\r\n}\r\n");
                    }

                    vm.sectionsOverlay.show = false;
                    vm.sectionsOverlay = null;

                },
                close: function(model) {
                    // close dialog
                    vm.sectionsOverlay.show = false;
                    vm.sectionsOverlay = null;
                    // focus editor
                    vm.editor.focus();
                }
            }
        }

        function openMasterTemplateOverlay() {

            // make collection of available master templates
            var availableMasterTemplates = [];

            // filter out the current template and the selected master template
            angular.forEach(vm.templates, function(template){
                if(template.alias !== vm.template.alias && template.alias !== vm.template.masterTemplateAlias) {
                    availableMasterTemplates.push(template);
                }
            });

            vm.masterTemplateOverlay = {
                view: "itempicker",
                title: "Choose master template",
                availableItems: availableMasterTemplates,
                show: true,
                submit: function(model) {

                    var template = model.selectedItem;

                    if (template && template.alias) {
                        vm.template.masterTemplateAlias = template.alias;
                        setLayout(template.alias + ".cshtml");
                    } else {
                        vm.template.masterTemplateAlias = null;
                        setLayout(null);
                    }

                    vm.masterTemplateOverlay.show = false;
                    vm.masterTemplateOverlay = null;
                },
                close: function(oldModel) {
                    // close dialog
                    vm.masterTemplateOverlay.show = false;
                    vm.masterTemplateOverlay = null;
                    // focus editor
                    vm.editor.focus();
                }
            };

        }

        function selectMasterTemplate(template) {

            if (template && template.alias) {
                vm.template.masterTemplateAlias = template.alias;
                setLayout(template.alias + ".cshtml");
            } else {
                vm.template.masterTemplateAlias = null;
                setLayout(null);
            }
            
        }

        function getMasterTemplateName(masterTemplateAlias, templates) {

            if(masterTemplateAlias) {

                var templateName = "";

                angular.forEach(templates, function(template){
                    if(template.alias === masterTemplateAlias) {
                        templateName = template.name;
                    }
                });

                return templateName;

            } else {
                return "No master";
            }
            
        }

        function removeMasterTemplate() {

            vm.template.masterTemplateAlias = null;

            // call set layout with no paramters to set layout to null
            setLayout();

        }

        function setLayout(templatePath){
            
            var templateCode = vm.editor.getValue();
            var newValue = templatePath;
            var layoutDefRegex = new RegExp("(@{[\\s\\S]*?Layout\\s*?=\\s*?)(\"[^\"]*?\"|null)(;[\\s\\S]*?})", "gi");

            if (newValue !== undefined && newValue !== "") {
                if (layoutDefRegex.test(templateCode)) {
                    // Declaration exists, so just update it
                    templateCode = templateCode.replace(layoutDefRegex, "$1\"" + newValue + "\"$3");
                } else {
                    // Declaration doesn't exist, so prepend to start of doc
                    //TODO: Maybe insert at the cursor position, rather than just at the top of the doc?
                    templateCode = "@{\n\tLayout = \"" + newValue + "\";\n}\n" + templateCode;
                }
            } else {
                if (layoutDefRegex.test(templateCode)) {
                    // Declaration exists, so just update it
                    templateCode = templateCode.replace(layoutDefRegex, "$1null$3");
                }
            }

            vm.editor.setValue(templateCode);
            vm.editor.clearSelection();
            vm.editor.navigateFileStart();
            
            vm.editor.focus();
            // set form state to $dirty
            setFormState("dirty");

        }


        function insert(str) {
            vm.editor.moveCursorToPosition(vm.currentPosition);
            vm.editor.insert(str);
            vm.editor.focus();

            // set form state to $dirty
            setFormState("dirty");
        }

        function wrap(str) {

            var selectedContent = vm.editor.session.getTextRange(vm.editor.getSelectionRange());
            str = str.replace("{0}", selectedContent);
            vm.editor.insert(str);
            vm.editor.focus();
            
            // set form state to $dirty
            setFormState("dirty");
        }

        function persistCurrentLocation() {
            vm.currentPosition = vm.editor.getCursorPosition();
        }

        function setFormState(state) {
            
            // get the current form
            var currentForm = angularHelper.getCurrentForm($scope);

            // set state
            if(state === "dirty") {
                currentForm.$setDirty();
            } else if(state === "pristine") {
                currentForm.$setPristine();
            }
        }
    
        vm.init();

    }

    angular.module("umbraco").controller("Umbraco.Editors.Templates.EditController", TemplatesEditController);
})();
