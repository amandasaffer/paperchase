Template.Recommend.events({
	'submit form': function(e,t){
		e.preventDefault();
		Meteor.formActions.saving();
		var inputs = {};
		var errors = [];

		inputs['user_id'] = $('#user_id').val();
		inputs['name_first'] = $('#name_first_input').val();
		inputs['user_email'] = $('#email_input').val();
		inputs['name_last'] = $('#name_last_input').val();
		inputs['institution'] =  $('#institution_input').val();
		inputs['position'] =  $('#position_input').val();
		inputs['lib_email'] = $('#lib_email_input').val();
		inputs['message'] =  $('#message_input').val();

		//get checkboxe recommendations
		var recommendations = [];
		$('.checkbox-recommend').each(function(i){
			if($(this).prop('checked')){
				var checkbox_id = $(this).attr('id');
				var text = $('label[for="'+checkbox_id+'"]').text();
				recommendations.push(text);
			}
		});
		if(recommendations.length > 0){
			inputs['recommendations'] = recommendations;
		}


		// check required
		if(!inputs['institution']){
			errors.push('Institution' + ' Required');
			$('#institution_input').addClass('invalid');
		}

		if(errors.length === 0 ){
			//submit form
			Meteor.call('addReccomendation', inputs, function(error,result){
				if(error){
					console.log('ERROR - addReccomendation');
					console.log(error);
				}else{
					Meteor.formActions.success();
				}
			});
		}else{
			//show errors
			Meteor.formActions.error(); //update dom for user
			Session.set('errorMessages',errors); //reactive template variable for ErrorMessages will loop through these
		}
	}
});

Template.Subscribe.events({
	'click button': function(e){
		e.preventDefault();
	}
})