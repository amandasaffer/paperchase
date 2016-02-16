// Admin
// -------
Template.Admin.onRendered(function () {
	$('.button-collapse').sideNav();
	$('.collapsible').collapsible();
});

// Navigation
// -----------
Template.AdminNav.onRendered(function () {
	$('.collapsible-nav').collapsible();
});

// Site Control
// ------------
Template.AdminSiteControl.onRendered(function () {
	$('.side-nav-options').sortable();
});

// DOI Status
// ---------------
Template.piiFilter.onCreated(function () {
    this.filter = new ReactiveTable.Filter('piiFilter', ['paperchase.ids.pii']);
});

// Article
// ------------
Template.AdminArticle.onRendered(function () {
	// scroll to anchor
	if(window.location.hash) {
		$('html, body').animate({
			scrollTop: $(window.location.hash).position().top
		}, 500);
	}
});
// Article Form
Template.AdminArticleForm.onRendered(function () {
	Meteor.adminArticle.readyArticleForm();
});
Template.AdminDateInput.onRendered(function() {
	Meteor.dates.initiateDatesInput();
});
Template.AdminHistoryInput.onRendered(function() {
	Meteor.dates.initiateDatesInput();
});
Template.AdminArticleFormAuthors.onRendered(function() {
	Meteor.adminArticle.initiateAuthorsSortable();
});
Template.AdminArticleFormAffiliations.onRendered(function() {
	Meteor.adminArticle.initiateAffiliationsSortable();
});

// XML Upload
// ----------
Template.AdminArticleXmlUpload.onRendered(function () {
	Session.set('fileNameXML','');
    Session.set('article',null);
    Session.set('xml-uploaded',false);
});


// Volume
// ------
Template.AdminVolumeIssue.onRendered(function () {
    $('#volume-issues-list').sortable();
});

// Issue
// ------
Template.AdminIssue.onRendered(function () {
    Meteor.dates.initiateDatesInput();
});


// News
// ------
Template.AdminNewsForm.onRendered(function () {
	Meteor.adminNews.readyForm();
});

// Data Submissions
// --------------
Template.AdminDataSubmissions.onRendered(function () {
	$('select').material_select();
	Session.set('submission_list',null);
});
Template.AdminDataSubmissionsPast.onRendered(function () {
	Session.set('article-id',null);
	Session.set('article',null);
	$('ul.tabs').tabs();
});

// Editorial Board
// ---------------
Template.AdminEditorialBoardForm.onRendered(function () {
	Meteor.adminEdBoard.readyForm();
});

// For Authors
// ---------------
Template.AdminForAuthors.onDestroyed(function () {
	Session.set('sectionId',null);
});
Template.AdminForAuthors.onRendered(function () {
	$('.sections-list').sortable();
});
Template.AdminForAuthorsForm.onRendered(function () {
	// console.log('..AdminEditorialBoardForm onRendered');
	Meteor.adminForAuthors.readyForm();
});
Template.AdminForAuthorsForm.onDestroyed(function () {
	Session.set('sectionId',null);
});

// About
// ---------------
Template.AdminAbout.onDestroyed(function () {
	Session.set('aboutSectionId',null);
});
Template.AdminAbout.onRendered(function () {
	$('.sections-list').sortable();
});
Template.AdminAboutForm.onRendered(function () {
	Meteor.adminAbout.readyForm();
});
Template.AdminForAuthorsForm.onDestroyed(function () {
	Session.set('aboutSectionId',null);
});


// Advance
// -------
Template.AdminAdvanceArticles.onRendered(function() {
    $('#advance-table').sortable();
});

Template.AdminAdvanceArticles.onRendered(function() {
    $('.articles, .article-sections').sortable({
        connectWith: '.articles',
        cursor: 'move',
        handle: '.handle',
        zIndex: 9999,
        start: function(e,ui) {
            $(ui.item).css('z-index', 12000);
        },
        update: function(e, ui) {
            var newOrder = [];
            var newMongoIdOrder = Meteor.advance.orderViaAdmin(); // just returns mongo IDs
            var allAdvance = Session.get('advanceAdmin');
            var allAdvanceByMongo = {};
            allAdvance.forEach(function(section){
                section.articles.forEach(function(article){
                    if(article.section_end){
                        delete article.section_end;
                    }
                    if(article.section_start){
                        delete article.section_start;
                    }
                    if(article.first){
                        delete article.first;
                    }

                    allAdvanceByMongo[article._id] = article;
                });
            });
            newMongoIdOrder.forEach(function(id){
                newOrder.push(allAdvanceByMongo[id]); // so that we can maintain section information, article info
            });

            var output = Meteor.advance.groupArticles(newOrder);
            Session.set('advanceAdmin',output); // keep ui up to date with session variable
        }
    });
});


// Sections
// -------
Template.AdminSections.onRendered(function() {
    Session.set('paperSectionId',null);
    Session.set('errorMessage',null);
    Session.set('savedMessage',null);
});