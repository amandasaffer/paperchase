Meteor.methods({
	advancePublish: function(){
		var list = sorters.findOne({name:'advance'});
		list = list.articles;
		var out = [];
		for (var i = 0; i < list.length; i++){
			var article = list[i];
			var section = sections.findOne({'section_id' : article['section_id']});
			  article['section_name'] = section['section_name'];

			out.push(article);
		}

		return publish.insert({
				name: 'advance'
				,pubtime: new Date
				,data: out
			});
	},
	compareWithLegacy: function(legacyArticles){
		// console.log('..compareWithLegacy');
		var allPii = {};
		var result = {};
		result.paperchaseOnly = [];
		result.ojsOnly = [];
		result.allPiiCount = 0;
		if(legacyArticles){
			// OJS Articles
			result.ojsCount = legacyArticles.length;
			legacyArticles.forEach(function(ojsA){
				// console.log('OJS', ojsA.pii);
				allPii[ojsA.pii] = {
					ojs : true
				}
			});
			// Paperchase Articles
			var order = sorters.findOne({name:'advance'});
			var pcArticles = order.articles;
			result.paperchaseCount = pcArticles.length;
			pcArticles.forEach(function(pcA){
				// console.log('paperchase', pcA.ids.pii)
				if(!allPii[pcA.ids.pii]){
					allPii[pcA.ids.pii] = {};
					result.paperchaseOnly.push(pcA);
				}
				allPii[pcA.ids.pii].paperchase = true;
			});
			// Compare. Get articles only in OJS
			for(var pii in allPii){
				// console.log(pii, allPii[pii]);
				result.allPiiCount++;
				if(allPii[pii].paperchase != true){
					var ojsObj = {
						pii: pii,
						query: {
							id : pii,
							journal: 'oncotarget',
							id_type: 'pii',
							advance: true
						}
					}

					result.ojsOnly.push(ojsObj);
				}
			}
			return result;
		}else{
			return;
		}
	},
	makeNewOrder: function(sectionsOrder){
		var fut = new future();
		var newOrder = [];

		var articlesList = sorters.findOne({name:'advance'});
		articlesList = articlesList.articles;
		articlesList.sort(function(a,b){
			return new Date(a.dates.epub).getTime() - new Date(b.dates.epub).getTime()
		});
		articlesList.reverse();

		var articlesBySection = Meteor.advance.articlesBySection(articlesList);
		var mongoIdsBySection = {};

		for(var articleSection in articlesBySection){
			mongoIdsBySection[articleSection] = [];
			articlesBySection[articleSection].forEach(function(article){
				mongoIdsBySection[articleSection].push(article._id);
			})
		}
			// console.log(mongoIdsBySection);

		sectionsOrder.forEach(function(section){
			newOrder = newOrder.concat(mongoIdsBySection[section]);
		});
		Meteor.call('updateList','advance', newOrder, function(error,result){
			if(error){
				// console.log('error!');
				throw new Meteor.Error(error);
			}else if(result){
				// console.log('success!');
				fut['return'](true);
			}
		});
		return fut.wait();
	},
	updateAdvanceResearch: function(articles){
		// console.log('updateAdvanceResearch');
		// console.log(articles);
		var fut = new future();
		var track = 0;
		var recent = 0;
		var updated = 0;
		var result = {};
		var order = sorters.findOne({name:'advance'});
		var orderBySectionId = Meteor.call('orderBySectionId',order.articles);
		var total = 0;
		for(var article in articles){
			total++
		}
		// update all article docs
		// and get order ready to update
		for(var article in articles){
			track++;
			// console.log(article, articles[articles]);
			var updateObj = {};
			var updateArticle = false;
			if(articles[article] == true){
				// recent checked
				updateObj.section_id = 0;
				recent++;
				if(orderBySectionId[0].indexOf(article) == -1 ){
					// article was added to Recent Research Papers
					updateArticle = true;
				}
			}else{
				// recent NOT checked
				if(orderBySectionId[0].indexOf(article) != -1 ){
					// article was in Recent Research Papers but now removed
					updateArticle = true;
				}
				updateObj.section_id = 5;
			}
			if(updateArticle){
				// console.log('update: ',article,updateObj);
				Meteor.call('updateArticle',article, updateObj, function(error,result){
					if(result){
						// now update the order
						Meteor.call('advanceMoveArticle', article, updateObj.section_id, function(error,result){
							if(result){
								updated++;
							}
						});
					}
				});
			}

			if(track == total){
				result = {
					recent: recent,
					updated: updated
				}
				fut['return'](result);
			}
		}




		return fut.wait();
	},
	orderBySectionId: function(articles){
		var byId = {};
		for(var i=0 ; i<articles.length ; i++){
			if(!byId[articles[i].section_id]){
				byId[articles[i].section_id] = [];
			}
			byId[articles[i].section_id].push(articles[i]._id);
		}
		// console.log('byId',byId);
		return byId;
	},
	advanceAddArticleToSection: function(mongoId, sectionId){
		// console.log('advanceAddArticleToSection',mongoId, sectionId);
		var sorts = sorters.findOne({'name': 'advance'});
		var position = sorts.order.length;
		for(var i=0; i < sorts.order.length; i++) {
			match = articles.findOne({_id:sorts.order[i], section_id:sectionId});
			if(match) {
				position = i;
				i = sorts.order.length;
			}
		}

		return sorters.update({name : 'advance'}, {$push : {
			'order': {
				$each: [mongoId],
				$position: position
		}}});
	},
	advanceMoveArticle: function(mongoId, newSectionId){
		// console.log('advanceMoveArticle',mongoId,newSectionId)
		var fut = new future();
		Meteor.call('sorterRemoveItem', 'advance', mongoId, function(error,result){
			if(error){
				fut['return'](error);
			}else if(result){
				Meteor.call('advanceAddArticleToSection', mongoId, newSectionId, function(error,result){
					if(error){
						fut['return'](error);
					}else if(result){
						fut['return'](true);
					}
				});
			}
		})
		return fut.wait();
	}
});
