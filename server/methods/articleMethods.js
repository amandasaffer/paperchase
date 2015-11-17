// All of these methods are for admin article
Meteor.methods({
	addArticle: function(articleData){
		// console.log('--addArticle | pmid = '+articleData['ids']['pmid']);

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
							console.log('ERROR');
							console.log(error);
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

		//INSERT into articles colection
		return articles.insert(articleData);
	},
	updateArticle: function(mongoId, articleData){
		// console.log('--updateArticle |  mongoId = ' + mongoId);
		var duplicateArticle;
		if(!mongoId){
			// New Article
			// make sure article does not already exist
			// TODO: loose title check
			duplicateArticle = articles.findOne({title : articleData.title});
		}
		if(!mongoId && !duplicateArticle){
			// Add new article
			return Meteor.call('addArticle', articleData);
		}else if(mongoId){
			// Update existing
			return articles.update({'_id' : mongoId}, {$set: articleData});
		}else{
			throw new Meteor.Error('ERROR: Duplicate Article - ' + duplicateArticle._id);
		}
	},
	pushArticle: function(mongoId, field, articleData){
		var updateObj = {};
		updateObj[field] = articleData;
		return articles.update({'_id' : mongoId}, {$push: updateObj});
	},
	updateArticleByPmid: function(pmid, articleData){
		// console.log('--updateArticleByPmid |  pmid = '+pmid);
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
	processXML: function(fileName,batch){
		// for importing XML to DB
		if(fileName)
		var j = {},
			xml;
		var fut = new future();

		var filePath = '/Users/jl/sites/paperchase/uploads/xml/';//TODO: add paths
		if(batch){
			filePath = '/Users/jl/sites/paperchase/uploads/pmc_xml/';
		}

		var file = filePath + fileName;
		fs.exists(file, function(fileok){
			if(fileok){
				fs.readFile(file, function(error, data) {
					if(data)
					xml = data.toString();
					if(error){
						return 'ERROR';
					}else{
						parseString(xml, function (err, result) {
							if(err){
								return 'ERROR';
							}else{
								//Process JSON for meteor templating and mongo db
								var articleJSON = result['pmc-articleset']['article'][0]['front'][0]['article-meta'][0];
								//TITLE
								var titleGroup = xml.substring(xml.lastIndexOf('<title-group>')+1,xml.lastIndexOf('</title-group>'));
								var titleTitle = titleGroup.substring(titleGroup.lastIndexOf('<article-title>')+1,titleGroup.lastIndexOf('</article-title>'));
								titleTitle = titleTitle.replace('article-title>','');
								titleTitle = Meteor.adminBatch.cleanString(titleTitle);
								j['title'] = titleTitle;


								j['volume'] = parseInt(articleJSON['volume'][0]);
								j['issue'] = parseInt(articleJSON['issue'][0]);
								j['page_start'] = parseInt(articleJSON['fpage'][0]);
								j['page_end'] = parseInt(articleJSON['lpage'][0]);

								//KEYWORDS
								if(articleJSON['kwd-group']){
									j['keywords'] =  articleJSON['kwd-group'][0]['kwd'];
								}

								//ABSTRACT
								if(articleJSON['abstract']){
									var abstract = xml.substring(xml.lastIndexOf('<abstract>')+1,xml.lastIndexOf('</abstract>'));
									abstract = abstract.replace('abstract>\n ', '');
									abstract = abstract.replace('</p>\n','</p>');
									abstract = abstract.replace(/^[ ]+|[ ]+$/g,'');
									abstract = Meteor.adminBatch.cleanString(abstract);
									j['abstract'] = abstract;
								}

								//ARTICLE TYPE
								//TODO: These are nlm type, possible that publisher has its own type of articles
								//TODO: Update article type collection if this type not present
								j['article_type'] = {};
								j['article_type']['type'] = articleJSON['article-categories'][0]['subj-group'][0]['subject'][0];
								j['article_type']['short_name'] = result['pmc-articleset']['article'][0]['$']['article-type'];

								//IDS
								j['ids'] = {};
								var idList = articleJSON['article-id'];
								var idListLength = idList.length;
								for(var i = 0 ; i < idListLength ; i++){
									var type = idList[i]['$']['pub-id-type'];
									var idCharacters = idList[i]['_'];
									j['ids'][type] = idCharacters;
								}

								//AUTHORS
								if(articleJSON['contrib-group']){
									j['authors'] = [];
									var authorsList = articleJSON['contrib-group'][0]['contrib'];
									var authorsListLength = authorsList.length;
									for(var i = 0 ; i < authorsListLength ; i++){
										var author = {};
										var name_first = authorsList[i]['name'][0]['given-names'][0];
										var name_last = authorsList[i]['name'][0]['surname'][0];
										author['name_first'] = name_first;
										author['name_last'] = name_last;
										j['authors'].push(author);
									}
								}

								//PUB DATES
								j['dates'] = {}
								var dates = articleJSON['pub-date'];
								var datesLength = dates.length;
								for(var i = 0 ; i < datesLength ; i++){
									var dateType =  dates[i]['$']['pub-type'];
									var d = '';
									var hadDay = false;
									if(dates[i]['month']){
										d += dates[i]['month'][0] + ' ';
									}
									if(dates[i]['day']){
										d += dates[i]['day'][0] + ', ';
										hadDay = true;
									}else{
										//usually for type collection
										d += 1 + ', ';
									}
									if(dates[i]['year']){
										d += dates[i]['year'][0];
									}
									if(hadDay){
										//gonna use time of the day to differentiate dates that had this and didn't
										d += ' 00:00:00 EST';
									}else{
										d += ' 12:00:00 EST';
									}
									var dd = new Date(d);

									j['dates'][dateType] = dd;
								}

								//HISTORY DATES
								if(articleJSON['history']){
									j['history'] = {};
									var history = articleJSON['history'][0]['date'];
									var historyLength = history.length;

									for(var i = 0 ; i < historyLength ; i++){
										var dateType = history[i]['$']['date-type'];
										var d = '';
										if(history[i]['month']){
											d += history[i]['month'][0] + ' ';
										}
										if(history[i]['day']){
											d += history[i]['day'][0] + ', ';
										}
										if(history[i]['year']){
											d += history[i]['year'][0] + ' ';
										}
										var dd = new Date(d);
										j['history'][dateType] = dd;
									}
								}

								// console.log(j);

								fut['return'](j);	//this what is returned. j = is the fixed json.
							}
						});
					}

				});
			}else{
				console.log('file not found');
			}
		});
		return fut.wait();
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
					'issue': issue
				});
			}
		}
		// console.log(issueId);
		return issueId;
	},
	preProcessArticle: function(articleId){
		// console.log('..preProcessArticle');
		var article;
		article = articles.findOne({'_id': articleId});
		if(!article){
			article = {};
		}

		// Affiliations
		// ------------
		// add ALL affiliations for article to author object,
		// for checkbox input
		var affs;
		affs = article.affiliations;
		if(article.authors){
			var authorsList = article.authors;
			for(var i=0 ; i < authorsList.length; i++){
				var current = authorsList[i]['affiliations_numbers'];
				var authorAffiliationsEditable = [];
				if(authorsList[i]['ids']['mongo_id']){
					var mongo = authorsList[i]['ids']['mongo_id'];
				}else{
					//for authors not saved in the db
					var mongo = Math.random().toString(36).substring(7);
				}

				if(affs){
					for(var a = 0 ; a < affs.length ; a++){
						var authorAff = {
							author_mongo_id: mongo
						}
						if(current && current.indexOf(a) != -1){
							// author already has affiliation
							authorAff['checked'] = true;
						}else{
							authorAff['checked'] = false;
						}
						authorAffiliationsEditable.push(authorAff);
					}
					authorsList[i]['affiliations_list'] = authorAffiliationsEditable;
				}
			}
		}

		// Issues
		// ------
		// get ALL issues and volumes for list options and organize by volume
		var volumesList = Meteor.call('getAllVolumes');
		var issuesList = Meteor.call('getAllIssues');
		if(article.issue_id){
			for(var i=0 ; i<issuesList.length ; i++){
				if(issuesList[i]['_id'] === article.issue_id){
					issuesList[i]['selected'] = true;
				}
			}
		}
		article.volumes = Meteor.organize.issuesIntoVolumes(volumesList,issuesList);

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
			if(publisherArticleTypes[k]['name'] === articleType){
				selectObj['selected'] = true;
			}
			article['article_type_list'].push(selectObj);
		}
		return article;
	},
});