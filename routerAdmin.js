
/*
 ADMIN ROUTES
*/
if (Meteor.isClient) {

	// For Authors variables
	Session.setDefault('showForm',false);
	Session.setDefault('sectionId',null);

	Router.route('/admin', {
		name: 'admin.dashboard',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('articlesRecentFive')
			]
		},
		data: function(){
			if(this.ready()){
				var articlesList = articles.find({}).fetch();
				return {
					articles: articlesList
				};
			}
		}
	});

	// Recommendations
	Router.route('/admin/recommendations',{
		name: 'AdminRecommendations',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return [
				Meteor.subscribe('recommendations')
			]
		},
		data: function(){
			if(this.ready()){
				return{
					recommendations: recommendations.find().fetch()
				}
			}
		}
	});
	Router.route('/admin/recommendation/:_id',{
		name: 'AdminRecommendationUpdate',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return [
				Meteor.subscribe('recommendationData',this.params._id)
			]
		},
		data: function(){
			if(this.ready()){
				return{
					recommendation: recommendations.findOne({'_id':this.params._id})
				}
			}
		}
	});

	// Data submissions
	Router.route('/admin/data_submissions',{
		name: 'AdminDataSubmissions',
		layoutTemplate: 'Admin',
		onBeforeAction: function(){
			Session.set('submission_list',null);
			Session.set('error',false);
			this.next();
		},
		waitOn: function(){
			return[
				Meteor.subscribe('issues'),
				Meteor.subscribe('volumes'),
				Meteor.subscribe('articleTypes')
			]
		}
	});
	Router.route('/admin/data_submissions/past',{
		name: 'AdminDataSubmissionsPast',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('adminUsers'),
				Meteor.subscribe('submissions'),
				Meteor.subscribe('articles')
			]
		},
		data: function(){
			if(this.ready()){
				return{
					articles: articles.find({},{submissions:1}).fetch(),
					submissions: submissions.find().fetch()
				}
			};
		}
	});

	// Intake
	// xml uploading
	Router.route('/admin/article_xml',{
		name: 'adminArticleXmlIntake',
		layoutTemplate: 'Admin'
	});
	Router.route('/admin/article-xml/process',{
		name: 'adminArticleXmlProcess',
		layoutTemplate: 'Admin',
		onBeforeAction: function(){
			var fileNameXML = Session.get('fileNameXML');
			if(fileNameXML === ''){
				Router.go('adminArticleXmlIntake');
			}else{
				this.next();
			}
		},
		waitOn: function(){
			return[
				Meteor.subscribe('articles'),
				Meteor.subscribe('issues')
			]
		},
		data: function(){
			var fileName = Session.get('fileNameXML');
			var newArticle;
			newArticle =  ReactiveMethod.call('processXML',fileName);
			if(newArticle){
				//add issue_id if exists,
				//later when INSERT into articles, check for if issue_id in doc (in meteor method addArticle)
				var articleIssue = issues.findOne({'volume' : newArticle['volume'], 'issue': newArticle['issue']});
				if(articleIssue){
					newArticle['issue_id'] = articleIssue['_id'];
				}

				//TODO: better way of checking if article exists, title could change during production.
				var articleExists = articles.findOne({'title' : newArticle['title']});
				return {
					article: newArticle,
					articleExists: articleExists
				}
			}
		}
	});

	// Article
	Router.route('/admin/articles',{
		name: 'adminArticlesDashboard',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('feature'),
				Meteor.subscribe('advance'),
				Meteor.subscribe('sortedList','advance')
			]
		},
		data: function(){
			if(this.ready()){
				var featureList = articles.find({'feature':true},{sort:{'_id':1}}).fetch();
				var sorted  = sorters.findOne();
				var sortedArticles;
				var journal = journalConfig.findOne();
				journal = journal.journal;
				if(sorted['articles']){
					sortedArticles = sorted['articles'];
				}
				return {
					feature : featureList,
					advance : sortedArticles,
					journal : journal
				}
			}
		}
	});
	Router.route('/admin/articles/list',{
		name: 'AdminArticlesList',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
			Meteor.subscribe('articles')
			]
		},
		data: function(){
			return {
				articles : articles.find().fetch()
			}
		}
	});
	Router.route('/admin/article/:_id',{
		name: 'AdminArticle',
		layoutTemplate: 'Admin',
		onBeforeAction: function(){
			// check if article exists
			var articleExistsExists = articles.findOne({'_id': this.params._id});
			if(!articleExistsExists){
				// if the mongo id search found nothing, search by pii
				var articlePii = String(this.params._id);
				var articleByPii = articles.findOne({'ids.pii': articlePii});
				// check if :_id is a pii and not Mongo ID
				if(articleByPii){
					Router.go('AdminArticle', {_id: articleByPii._id});
				}else{
					Router.go('AdminArticleAdd');
				}
			}

			Meteor.call('preProcessArticle',this.params._id,function(error,result){
				if(error){
					console.log('ERROR - preProcessArticle');
					console.log(error);
				}
				if(result){
					Session.set('article',result);
				}
			});
			this.next();
		},
		waitOn: function(){
			return[
				Meteor.subscribe('articleInfo',this.params._id)
			]
		},
		data: function(){
			if(this.ready()){
				Session.set('article-id',this.params._id);
			}
		}
	});
	Router.route('/admin/add_article/',{
		name: 'AdminArticleAdd',
		layoutTemplate: 'Admin',
		onBeforeAction: function(){
			Meteor.call('preProcessArticle',function(error,result){
				if(error){
					console.log('ERROR - preProcessArticle');
					console.log(error);
				}
				if(result){
					Session.set('article',result);
				}
			});
			this.next();
		},
	});

	// Advance articles
	Router.route('/admin/articles/advance',{
		name: 'AdminAdvanceArticles',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('advance'),
				Meteor.subscribe('sortedList','advance')
			]
		},
		data: function(){
			if(this.ready()){
				var sorted  = sorters.findOne();
				return{
					articles: sorted['articles']
				}
			}
		}
	});

	// Archive
	Router.route('/admin/archive', {
		name: 'adminArchive',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('volumes'),
				Meteor.subscribe('issues'),
				Meteor.subscribe('articles')
			]
		}
	});

	// Issue
	// TODO: LIMIT subscription of articles to just issue
	Router.route('/admin/issue/:vi', {
		name: 'AdminIssue',
		layoutTemplate: 'Admin',
		waitOn: function(){
			var vi = this.params.vi;
			var matches = vi.match('v([0-9]+)i([0-9]+)');
			var volume = parseInt(matches[1]);
			var issue = parseInt(matches[2]);
			return[
				Meteor.subscribe('articles'),
				Meteor.subscribe('issue',volume,issue)
			]
		},
		data: function(){
			if(this.ready()){
				var vi = this.params.vi;
				var matches = vi.match('v([0-9]+)i([0-9]+)');
				var volume = parseInt(matches[1]);
				var issue = parseInt(matches[2]);
				var issueData = issues.findOne({'volume' : parseInt(volume), 'issue':issue});
				var issueArticles = Meteor.organize.getIssueArticlesByID(issueData['_id']);
				issueData['articles'] = issueArticles;
				var data = {
					issue: issueData
				};
				//do not change issue variable name in data, we need this to get mongoid to update the doc
				return data;
			}
		}
	});

	// Users
	Router.route('/admin/users', {
		name: 'AdminUsers',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
			Meteor.subscribe('allUsers')
			]
		},
		data: function(){
			if(this.ready()){
				var users = Meteor.users.find().fetch();
				return {
					users: users
				};
			}
		}
	});
	Router.route('/admin/user/:_id', {
		name: 'AdminUser',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
			Meteor.subscribe('userData',this.params._id)
			]
		}
		,data: function(){
			if(this.ready()){
				var id = this.params._id;
				var u = Meteor.users.findOne({'_id':id});
				//user permissions
				u['adminRole'] = '';
				u['superRole'] = '';
				u['articlesRole'] = '';
				var r = u.roles;
				var rL = r.length;
				for(var i = 0 ; i < rL ; i++){
					u[r[i]+'Role'] = 'checked';
				}

				if(u.subscribed) {
					u['subbed'] = 'checked';
				}

				return {
					u: u
				};
			}
		}
	});
	Router.route('/admin/user/:_id/subs', {
		name: 'AdminUserSubs',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('userData',this.params._id),
				Meteor.subscribe('issues')
			]
		},
		data: function(){
			if(this.ready()){
				var id = this.params._id;
				var u = Meteor.users.findOne({'_id':id});
				return {
					u: u
					//,volumes:volumes
					//,issues:issues
				};
			}
		}
	});
	Router.route('/admin/adduser', {
		name: 'AdminAddUser',
		layoutTemplate: 'Admin'
	});

	// Authors
	Router.route('/admin/authors', {
		name: 'AdminAuthors',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
			Meteor.subscribe('authorsList'),
			]
		},
		data: function(){
			if(this.ready()){
				var authorsList = authors.find().fetch();
				return {
					authors : authorsList
				};
			}
		}
	});
	Router.route('/admin/author/:_id', {
		name: 'AdminAuthor',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
			Meteor.subscribe('articles'),
			Meteor.subscribe('authorData',this.params._id)
			]
		},
		data: function(){
			if(this.ready()){
				var mongoId = this.params._id;
				var authorsData = authors.findOne({'_id':mongoId});
				var authorArticlesList = articles.find({ 'authors' : { '$elemMatch' : { 'ids.mongo_id' :  mongoId } } });
				return {
					author : authorsData,
					articles: authorArticlesList
				};
			}
		}
	});

	// Editorial Board
	Router.route('/admin/editorial-board', {
		name: 'AdminEditorialBoard',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('entireBoard'),
			]
		},
		data: function(){
			if(this.ready()){
				var edboardList = edboard.find().fetch();
				// console.log(edboardList);
				return {
					edboard : edboardList
				};
			}
		}
	});
	Router.route('/admin/editorial-board/add', {
		name: 'AdminEditorialBoardAdd',
		layoutTemplate: 'Admin',
		data: function(){
			if(this.ready()){
				return {
					member : Meteor.adminEdBoard.formPrepareData()
				};
			}
		}
	});
	Router.route('/admin/editorial-board/edit/:_id', {
		name: 'AdminEditorialBoardEdit',
		layoutTemplate: 'Admin',
		onBeforeAction: function(){
			// TODO
			// Redirect if no member
			this.next();
		},
		waitOn: function(){
			return[
				Meteor.subscribe('edBoardMember',this.params._id),
			]
		},
		data: function(){
			if(this.ready()){
				return {
					member : Meteor.adminEdBoard.formPrepareData(this.params._id)
				};
			}
		}
	});

	// For Authors
	Router.route('/admin/for-authors', {
		name: 'AdminForAuthors',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('forAuthors'),
				Meteor.subscribe('sortedList','forAuthors')
			]
		},
		data: function(){
			if(this.ready()){
				var sections = forAuthors.find().fetch();
				var sorted  = sorters.findOne();
				return {
					sections : sorted['ordered']
				};
			}
		}
	});

	// Institutions
	Router.route('/admin/institution', {
		name: 'AdminInstitution',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('institutions')
			]
		},
		data: function () {
			return {
				institutions: institutions.find({})
			};
		}
	});
	Router.route('/admin/institution/add', {
		layoutTemplate: 'Admin',
		name: 'AdminInstitutionAdd',
		data: function(){
			return {
				insertForm: true
			}
		}
	});
	Router.route('/admin/institution/edit/:_id', {
		layoutTemplate: 'Admin',
		name: 'AdminInstitutionForm',
		waitOn: function(){
			return[
			Meteor.subscribe('institution',this.params._id)
			]
		},
		data: function(){
			return {
				institution: institutions.findOne({"_id":this.params._id}),
				updateForm: true
			}
		}
	});

	//this route is used to query pmc for all xml.. don't go here.
	Router.route('/admin/batch_process', {
		name: 'AdminBatchXml',
		layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('articles')
			]
		},
	});
}