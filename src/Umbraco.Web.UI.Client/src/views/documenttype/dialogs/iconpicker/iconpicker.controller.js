/**
 * @ngdoc controller
 * @name Umbraco.Editors.DocumentType.PropertyController
 * @function
 *
 * @description
 * The controller for the content type editor property dialog
 */
function iconPickerController($scope, iconHelper) {

   $scope.loading = true;

   iconHelper.getIcons().then(function(icons) {
      $scope.icons = icons;
      $scope.loading = false;
   });

}

angular.module("umbraco").controller("Umbraco.Editors.DocumentType.IconPickerController", iconPickerController);
