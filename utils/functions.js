exports.adminCheckLoggedIn = (req,res,next) =>{
  if(req.session.user && req.session.user.type === 'Admin'){//&& req.body.UserName =='Admin' ){
    next()
  }else{
    res.redirect('/Login')
  }
}

exports.paCheckLoggedIn = (req,res,next) =>{
  if(req.session.user && req.session.user.type === 'President Ambassador'){//&& req.body.UserName =='Admin' ){
    next()
  }else{
    res.redirect('/Login')
  }
}

exports.adminOrPACheckLoggedIn = (req, res, next) => {
  if (
    req.session.user &&
    (req.session.user.type === 'Admin' || req.session.user.type === 'President Ambassador')
  ) {
    next();
  } else {
    res.redirect('/Login'); // or res.redirect('/Login') if you prefer
  }
}

exports.bypassLogin = (req, res,next) => {
  if(!req.session.user){
     next()
  }else{
    res.render('index')
  }
}
