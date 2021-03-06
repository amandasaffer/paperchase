// All of these methods are for admin article
Meteor.methods({
	addArticle: function(articleData){
		// console.log('--addArticle');
		var fut = new future();
		Meteor.call('articleExistenceCheck',articleData,function(error,result){
			if(error){
				// console.error('addArticle',error);
				throw new Meteor.Error('ERROR: Article - ', error);
				// return error;
			}else if(result){
				fut['return'](result);
				return result; //article already exists, but return the doc so we can notify user
			}else{
				if(articleData['authors']){
					var authorsList = articleData['authors'];
					for(var author = 0 ; author < authorsList.length; author++){
						//check if author doc exists in authors collection
						var authorDoc;
						authorsList[author]['ids'] = {};
						authorDoc = authors.findOne({'name_first' : authorsList[author]['name_first'],'name_last' : authorsList[author]['name_last']});
						if(!authorDoc){
							//INSERT into authors
							Meteor.call('addAuthor',authorsList[author],function(error, mongo_id){
								if(error){
									console.error('ERROR',error);
								}else{
									authorsList[author]['ids']['mongo_id'] = mongo_id;
								}
							});
						}else{
							//author doc already exists
							authorsList[author]['ids']['mongo_id'] = authorDoc['_id'];
						}
					}
				}

				if(articleData.volume && articleData.issue){
					// check if article doc
					Meteor.call('addIssue', {volume: articleData.volume, issue: articleData.issue}, function(error,result){
						if(result){
							articleData.issue_id = result;
						}
					});
				}

				// console.log('articleData',articleData);
				fut['return'](articles.insert(articleData));
				// return articles.insert(articleData);
			}
		});
		return fut.wait();
	},
	updateArticle: function(mongoId, articleData, batch){
		var fut = new future();
		// console.log('--updateArticle',mongoId,articleData);

		// the returned result will either be the result from updating/inserting the article doc,
		// if inserting an article and a duplicate was found, then that is returned.
		if(!mongoId){
			// Add new article
			Meteor.call('addArticle', articleData, function(error,result){
				if(error){
					throw new Meteor.Error('ERROR: Article - ', error);
				}else if(result){
					// return result;
					fut['return'](result);
				}
			});
		}else if(mongoId){
			// Update existing
			articleData.batch = batch;
			var updated = articles.update({'_id' : mongoId}, {$set: articleData});
			fut['return'](mongoId);
		}
		return fut.wait();
	},
	updateArticleBy: function(where, what){
		return articles.update(where, {$set: what});
	},
	pushArticle: function(mongoId, field, articleData){
		var updateObj = {};
		updateObj[field] = articleData;
		return articles.update({'_id' : mongoId}, {$push: updateObj});
	},
	updateArticleByPmid: function(pmid, articleData){
		// console.log('--updateArticleByPmid |  pmid = '+pmid, articleData);

		if(articleData.volume && articleData.issue){
			// check if article doc
			Meteor.call('addIssue', {volume: articleData.volume, issue: articleData.issue}, function(error,result){
				if(result){
					articleData.issue_id = result;
				}
			});
		}

		return articles.update({'ids.pmid' : pmid}, {$set: articleData});
	},
	addToArticleAffiliationsByPmid: function(pmid, affiliation){
		// console.log('--addToArticleAffiliationsByPmid | pmid = ' + pmid  + ' / affiliation = ' + affiliation);
		return  articles.update({'ids.pmid' : pmid}, {$addToSet: {'affiliations' : affiliation}});
	},
	pushPiiArticle: function(mongoId, ids){
		//used for batch processing of XML from PMC
		return articles.update({'_id' : mongoId}, {$set: {'ids' : ids}});
	},
	articleIssueVolume: function(volume,issue){
		// console.log('....articleIssueVolume v = ' + volume + ', i = ' + issue );
		// if article in issue:
		// 1. check if issue exists in issues collection. If not add. If issue exists or added, issue Mongo ID returned
		// 2. include issue Mongo id in article doc
		var issueInfo,
			issueId;
		if(volume && issue){
			// Does issue exist?
			issueInfo = Meteor.call('findIssueByVolIssue', volume, issue);
			if(issueInfo){
				issueId = issueInfo['_id'];
			}else{
				// This also checks volume collection and inserts if needed.
				issueId = Meteor.call('addIssue',{
					'volume': volume,
					'issue': issue,
					'issue_linkable' : Meteor.fxns.linkeableIssue(issue) // remove any slashed to avoid URL linking problems
				});
			}
		}
		// console.log(issueId);
		return issueId;
	},
	getSavedPii: function(mongoId){
		var art = articles.findOne({_id : mongoId}, {ids:1});
		return art.ids.pii;
	},
	getNewPii: function(){
		var highestPii = articles.findOne({},{sort: {'ids.pii' : -1}});
		return parseInt(highestPii.ids.pii) + 1;
	},
	preProcessArticle: function(articleId,article){
		// Article Form: On - Article Form & Data Submissions
		// article = parsed XML from S3 after upload
		// console.log('..preProcessArticle = ' + articleId);
		// console.log(article);
		var articleByPii,
			articleFromDb;

		// For when editing an article,
		// else after uploading XML and parsed article is passed to this function
		if(!article){
			article = articles.findOne({'_id': articleId});
		}else{
			// Compare XML and Database
			// Article exists in the database and this string is from the parsed XML uploaded to S3
			articleFromDb = articles.findOne({'_id': articleId});
			Meteor.call('compareProcessedXmlWithDb',article,articleFromDb,function(error,result){
				if(result){
					article = result;
				}
			});
		}

		// New or Edit article? If articleId given and PII found, then editing.
		articleByPii = articles.findOne({'ids.pii':articleId});
		if(!articleId){
			article = {}; // For a new article
			article.ids = {};
			// article.ids.pii = Meteor.call('getNewPii'); // no longer autofilling PII
		}else if(!article && !articleByPii){
			article = {}; // Article by PII not found. Then act like this is a new article
			article.ids = {};
			// article.ids.pii = Meteor.call('getNewPii'); // no longer autofilling PII
		}

		if(article){
			// For editing an existing article
			// or after uploading XML and updating an existing article's DB info

			// Affiliations
			// ------------
			// add ALL affiliations for article to author object,
			// needed for author affiliation checkbox input
			var affs;
			affs = article.affiliations;
			if(article.authors){
				var authorsList = article.authors;
				// Go through each author object
				for(var i=0 ; i < authorsList.length; i++){
					var current = authorsList[i]['affiliations_numbers'];
					var authorAffiliationsEditable = [];
					if(authorsList[i]['ids'] && authorsList[i]['ids']['mongo_id']){
						var mongo = authorsList[i]['ids']['mongo_id'];
					}else{
						//for authors not saved in the db
						var mongo = Math.random().toString(36).substring(7);
					}

					if(affs){
						for(var a = 0 ; a < affs.length ; a++){
							var authorAff = {
								author_mongo_id: mongo
							} // need the mongo ID for uniqueness, id attribute, for checkbox
							if(current && current.indexOf(a) != -1){
								// author already has affiliation
								authorAff['author_aff'] = 'checked';
							}else{
								authorAff['author_aff'] = false;
							}
							authorAffiliationsEditable.push(authorAff);
						}
						authorsList[i]['affiliations_list'] = authorAffiliationsEditable;
					}
				}
			}

			// Issues
			// ------
			article.volumes = Meteor.call('archive',article.issue_id);

			// Pub Status
			// ----------
			article['pub_status_list'] = pubStatusTranslate;
			// var statusFound = false;
			// if(article['pub_status']){
			// 	var pubStatusDisable = true;
			// }
			for(var p = 0; p < pubStatusTranslate.length; p++){
				if(article['pub_status_list'][p]['abbrev'] == article['pub_status']){
					article['pub_status_list'][p]['selected'] = true;
					// statusFound = true;
				}
				// if(!statusFound){
				// 	article['pub_status_list'][p]['disabled'] = true;
				// }
			}

			// Article Type
			// ------------
			// add ALL article types
			var articleType;
			if(article['article_type']){
				articleType = article['article_type']['name'];
			}
			article['article_type_list'] = [];
			var publisherArticleTypes = articleTypes.find().fetch();
			for(var k =0 ; k < publisherArticleTypes.length ; k++){
				var selectObj = {
					nlm_type: publisherArticleTypes[k]['nlm_type'],
					name: publisherArticleTypes[k]['name'],
					short_name: publisherArticleTypes[k]['short_name']
				}
				if(publisherArticleTypes[k]['name'] == articleType){
					selectObj['selected'] = true;
				}
				article['article_type_list'].push(selectObj);
			}

			// Article Section
			// ------------
			// add ALL article sections
			var selectedSectionId;
			if(article['section']){
				selectedSectionId = article['section'];
			}
			article['article_section_list'] = [];
			var publisherArticleSections = sections.find().fetch();
			for(var s =0 ; s < publisherArticleSections.length ; s++){
				var selectObj = {
					_id : publisherArticleSections[s]['_id'],
					name: publisherArticleSections[s]['name'],
					short_name: publisherArticleSections[s]['short_name']
				}
				if(publisherArticleSections[s]['_id'] == selectedSectionId){
					selectObj['selected'] = true;
				}
				article['article_section_list'].push(selectObj);
			}

			// console.log('--------------------article');
			// console.log(article);
			return article;
		}
	},
	duplicateArticles: function(){
		var result = {};
		var queryRes = {};
		queryRes.pii = articles.aggregate([
			{
				$group : {
					_id: {
						duplicate_field : '$ids.pii'
					} ,
					data: { '$addToSet' : { 'id' : '$_id','article_type' : '$article_type.name' } },
					count : {
						$sum: 1
					}
				}
			},
			{
				$match : {
					count : {
						$gt : 1
					}
				}
			}
		]);

		queryRes.pmid = articles.aggregate([
			{
				$group : {
					_id: {
						duplicate_field : '$ids.pmid'
					} ,
					data: { '$addToSet' : { 'id' : '$_id','article_type' : '$article_type.name' } },
					count : {
						$sum: 1
					}
				}
			},
			{
				$match : {
					count : {
						$gt : 1
					}
				}
			}
		]);
		queryRes.titles = articles.aggregate([
			{
				$group : {
					_id: {
						duplicate_field : '$title'
					} ,
					data: { '$addToSet' : { 'id' : '$_id', 'article_type' : '$article_type.name' } },
					count : {
						$sum: 1
					}
				}
			},
			{
				$match : {
					count : {
						$gt : 1
					}
				}
			}
		]);
		for(var duplicateType in queryRes){
			if(queryRes[duplicateType].length > 0 && queryRes[duplicateType][0]._id != null){
				var duplicateList = [];
				queryRes[duplicateType].forEach(function(duplicate){
					if(duplicate._id.duplicate_field != null){ //remove duplicates where field does not exist
						var obj = {
							duplicate_field: duplicate._id.duplicate_field,
							count: duplicate.count
						} // if object not reformatted, _id : {} return from aggregratio causes underscore to throw error Meteor does not currently support objects other than ObjectID as ids
						if(duplicate.data){
							obj.article_types = [];
							obj.mongo_ids = [];
							duplicate.data.forEach(function(duplicateArticle){
								obj.mongo_ids.push(duplicateArticle.id);
								obj.article_types.push(duplicateArticle.article_type);
							});
							// console.log(duplicate.data);
						}
						duplicateList.push(obj);
					}
				});
				result[duplicateType] = duplicateList;
			}else{
				result[duplicateType] = null; //for templating
			}
		}
		// console.log(result.pii);
		return result;
	},
	articleExistenceCheck: function(articleData){
		// console.log('--articleExistenceCheck',articleData);
		// before inserting article, check if doc already exists
		// right now only title required, so check for IDs before adding to query
		var query =  [
			{
				'title': articleData.title
			}
		];

		if(articleData.ids.pmid){
			query.push({
				'ids.pmid': articleData.ids.pmid
			});
		}
		if(articleData.ids.pmc){
			query.push({
				'ids.pmc': articleData.ids.pmc
			});
		}
		if(articleData.ids.pii){
			query.push({
				'ids.pii': articleData.ids.pii
			});
		}
		var exists = articles.findOne({ $or: query });
		if(exists){
			return exists;
		}
	}
});