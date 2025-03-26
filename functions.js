exports.adminCheckLoggedIn = (req,res,next) =>{
  if(req.session.user && req.session.user.type === 'Admin'){//&& req.body.UserName =='Admin' ){
    next()
  }else{
    res.render('index')
  }
}

exports.paCheckLoggedIn = (req,res,next) =>{
  if(req.session.user && req.session.user.type === 'President Ambassador'){//&& req.body.UserName =='Admin' ){
    next()
  }else{
    res.render('index')
  }
}

exports.bypassLogin = (req, res,next) => {
  if(!req.session.user){
     next()
  }else{
    res.render('index')
  }
}
