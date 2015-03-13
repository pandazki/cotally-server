module.exports = function(Detail) {
  Detail.observe('before save', function checkTime(ctx, next) {
    if (ctx.instance) {
      ctx.instance.createTime = new Date();
      if (ctx.instance.actorId)
        ctx.instance.actTime = new Date();
    } else {
      if (ctx.data.creatorId)
        ctx.data.createTime = new Date();
      if (ctx.data.actorId)
        ctx.data.actTime = new Date();
    }
    next();
  });
};
