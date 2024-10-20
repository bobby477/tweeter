const express = require('express')

const path = require('path')

const {open} = require('sqlite')

const sqlite3 = require('sqlite3')

const bcrypt = require('bcrypt')

const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())

const dpath = path.join(__dirname, 'twitterClone.db')

let db = null
const server = async () => {
  try {
    db = await open({filename: dpath, driver: sqlite3.Database})

    app.listen(3000, () => {
      console.log('success')
    })
  } catch (e) {
    console.log(`error ${e}`)
  }
}

server()

//auth

const auth = (request, response, next) => {
  const token = request.headers['authorization']
  const newtoken = token.split(' ')[1]

  if (newtoken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
    return
  } else {
    jwt.verify(newtoken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.userId = payload.userId
        next()
      }
    })
  }
}

//api1
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body

  const dbquery = `SELECT * FROM user WHERE username = '${username}';`

  const verify = await db.get(dbquery)

  if (verify === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hased = await bcrypt.hash(password, 10)

      const dquery = `INSERT INTO user (name,username,password,gender) VALUES ('${name}','${username}','${hased}','${gender}');`
      await db.run(dquery)
      response.send('User created successfully')
    }
  }
})

//api2
app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const dbquery = `SELECT * FROM user WHERE username='${username}';`

  const result = await db.get(dbquery)

  if (result === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const compare = await bcrypt.compare(password, result.password)

    if (compare === true) {
      const payload = {
        username: username,
        userId: result.user_id,
      }

      const jwtToken = await jwt.sign(payload, 'MY_SECRET_TOKEN')

      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//api3

const changeCase = result => {
  return result.map(each => {
    return {
      username: each.username,
      tweet: each.tweet,
      dateTime: each.date_time,
    }
  })
}

app.get('/user/tweets/feed/', auth, async (resquest, response) => {
  const dbquery = `SELECT user.username,tweet.tweet,tweet.date_time FROM user INNER JOIN tweet on user.user_id = tweet.user_id ORDER BY tweet.date_time DESC LIMIT 4;`

  const result = await db.all(dbquery)

  response.send(changeCase(result))
})

//api4
app.get('/user/following/', auth, async (request, response) => {
  const dbquery = `SELECT user.name from user INNER JOIN follower ON user.user_id = follower.following_user_id;`

  const result = await db.all(dbquery)

  response.send(result)
})

//api5
app.get('/user/followers/', auth, async (request, response) => {
  const dbquery = `SELECT user.name from user INNER JOIN follower ON user.user_id = follower.follower_user_id;`

  const result = await db.all(dbquery)

  response.send(result)
})

//api6
app.get('/tweets/:tweetId/', auth, async (request, response) => {
  const dbquery = `SELECT * FROM tweet INNER JOIN user ON user.user_id = tweet.user_id;`

  const result = await db.get(dbquery)
  const {tweetId} = request.params
  if (result === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const dquery = `SELECT tweet.tweet,count(like.like_id) as likes,count(reply.reply_id) as replies,tweet.date_time as datetime FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id INNER JOIN like ON reply.tweet_id = like.tweet_id WHERE tweet.tweet_id=${tweetId};`

    const result = await db.get(dquery)
    response.send(result)
  }
})

const inlist = newresult => {
  return {
    likes: newresult.map(each => each.username),
  }
}

//api7
app.get('/tweets/:tweetId/likes/', auth, async (request, response) => {
  const dbquery = `SELECT * FROM tweet INNER JOIN user ON user.user_id = tweet.user_id;`
  const {tweetId} = request.params
  const result = await db.get(dbquery)

  if (result === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const dbquery = `SELECT user.username FROM user INNER JOIN like ON user.user_id = like.user_id WHERE like.tweet_id = ${tweetId};`

    const newresult = await db.all(dbquery)
    console.log(newresult)
    response.send(inlist(newresult))
  }
})

//api8
app.get('/tweets/:tweetId/replies/', auth, async (request, response) => {
  const dbquery = `SELECT * FROM tweet INNER JOIN user ON user.user_id = tweet.user_id;`
  const {tweetId} = request.params
  const result = await db.get(dbquery)

  if (result === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const dbquery = `SELECT user.username AS name,reply.reply FROM user INNER JOIN reply ON user.user_id = reply.user_id WHERE reply.tweet_id=${tweetId};`

    const result = await db.all(dbquery)

    response.send(result)
  }
})

//api9

app.get('/user/tweets/', auth, async (request, response) => {
  const dbquery = `SELECT tweet.tweet,count(like.like_id) AS likes,count(reply.reply_id) AS replies,tweet.date_time AS dateTime FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id INNER JOIN like ON reply.tweet_id = like.tweet_id;`

  const result = await db.all(dbquery)

  response.send(result)
})

//api10

app.post('/user/tweets/', auth, async (request, response) => {
  const {tweet} = request.body
  console.log(tweet)
  const dbquery = `INSERT INTO tweet (tweet,user_id,date_time) VALUES ('${tweet}','NULL',"NULL");`

  await db.run(dbquery)
  response.send('Created a Tweet')
})

//api11

app.delete('/tweets/:tweetId/', auth, async (request, response) => {
  const dbquery = `SELECT * FROM tweet INNER JOIN user ON user.user_id = tweet.user_id;`
  const {tweetId} = request.params
  const result = await db.get(dbquery)

  if (result === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const dbquery = `DELETE FROM tweet WHERE tweet.tweet_id = ${tweetId};`
    await db.run(dbquery)
    response.send('Tweet Removed')
  }
})

module.exports = app
