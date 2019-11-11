var API_TOKEN = 'BOT_TOKEN_PLACEHOLDER';
var SPREADSHEET = SpreadsheetApp.openById('10R5UhuwIYelODj7FCtI8oF9c7Nznv6GWWRVItPXtvu0');
var ADMINS = [64259726];

var COMMANDS = {
    "/start": cmdStart,
    "/test": cmdTest,
    "/lock": cmdLock,
    "/unlock": cmdUnlock,
    "/register": cmdRegister,
    "/mark": cmdMark,
    "/unmark": cmdUnmark,
    "/addTasks": cmdAddTasks,
    "/link": cmdLink,
    "/distr": cmdDistr,
    "/ok": cmdOk,
    "/fail": cmdFail,
    "/unquestion": cmdUnquestion,
    "/queue": cmdQueue
};

var CACHE = [];

function doPost(e) {
    var update = JSON.parse(e.postData.contents);
    if (update.hasOwnProperty("callback_query")) {
        var q = update.callback_query;
        var data = q.data.split(",");
        var srcMsg = q.message;
        try {
            if (data[0] === "regAns") {
                var sheet = SPREADSHEET.getSheetByName("DB_STUDENTS");
                cacheDb(sheet);
                var id = dbGetRowIdFromTgId(sheet, data[2]);
                if (data[1] === "1") {
                    dbPutData(sheet, id, "VERIFIED", "1");
                }
                else {
                    dbPutData(sheet, id, "VERIFIED", "");
                    dbPutData(sheet, id, "TG_ID", "");
                    dbPutData(sheet, id, "TG_USERNAME", "");
                }
                editMessageText(srcMsg.chat.id, srcMsg.message_id,
                    "*Got a registration request:*\n\n" +
                    "*FIO:* " + dbGetData(sheet, id, "FIO") + "\n" +
                    "*TG_ID:* [" + data[2] + "](tg://user?id=" + data[2] + ")\n\n" +
                    "*Request was " + (data[1] === "1" ? "APPROVED" : "DECLINED") + "*");
                sendMessage(data[2], "Your registration request was *" + (data[1] === "1" ? "APPROVED" : "DECLINED") + "*")
            }
        } catch (ex) {
            sendMessage(srcMsg.chat.id, "Someone shot my leg, calling the ambulance...");

            var exMsg =
                "*ERROR REPORT*\n" +
                "*Date: " + Date() + "*\n\n" +
                "Callback dump:\n" +
                "```\n" + JSON.stringify(q) + "```\n\n" +
                "Exception dump:\n" +
                "```\n" + JSON.stringify(ex) + "```";

            sendMessage(64259726, exMsg)
        }
    }
    else if (update.hasOwnProperty("message")) {
        var msg = update.message;
        if (msg.hasOwnProperty("entities") && msg.entities[0].type === "bot_command") {
            var dbs = SPREADSHEET.getSheetByName("DB_STUDENTS");
            cacheDb(dbs);
            cacheConfig(SPREADSHEET.getSheetByName("CONFIG"));
            log(msg);
            var spl = msg.text.split(" ");
            try {
                if (isAdminOnly() && !isAdmin(msg.from.id)) {
                    sendMessage(msg.chat.id, "Bot is under maintenance. Contact admins for more info");
                    return;
                }
                if (COMMANDS[spl[0]] === undefined) {
                    sendMessage(msg.chat.id, "Command not found");
                    return;
                }
                COMMANDS[spl[0]](spl, msg);
            } catch (ex) {
                sendMessage(msg.chat.id, "Someone shot my leg, calling the ambulance...");

                var exMsg =
                    "*ERROR REPORT*\n" +
                    "*Date: " + Date() + "*\n\n" +
                    "Msg dump:\n" +
                    "```\n" + JSON.stringify(msg) + "```\n\n" +
                    "Exception dump:\n" +
                    "```\n" + JSON.stringify(ex) + "```";

                sendMessage(64259726, exMsg)
            }
        }
    }
}

function cmdTest(spl, msg) {

}

function cmdLock(spl, msg) {
    // USAGE: /lock <sheet> <task(s)>
    // EXAMPLE: /lock ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isAdmin(userId)) {
        sendMessage(chatId, "Command not found");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheet = SPREADSHEET.getSheetByName(spl[1]);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    uncompTasks.forEach(function (item) {
        if (isTaskExists(sheet, item) && !isTaskLocked(sheet, item)) {
            lockTask(sheet, item);
            goodTasks.push(item)
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully locked tasks: " + goodTasks.join(", ") + "!" : "No tasks were locked!")
}

function cmdUnlock(spl, msg) {
    // USAGE: /unlock <sheet> <task(s)>
    // EXAMPLE: /unlock ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isAdmin(userId)) {
        sendMessage(chatId, "Command not found");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheet = SPREADSHEET.getSheetByName(spl[1]);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    uncompTasks.forEach(function (item) {
        if (isTaskExists(sheet, item) && isTaskLocked(sheet, item)) {
            unlockTask(sheet, item);
            goodTasks.push(item)
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully unlocked tasks: " + goodTasks.join(", ") + "!" : "No tasks were unlocked!")
}

function cmdRegister(spl, msg) {
    // USAGE: /register <FIO>
    // EXAMPLE: /register Лебедев Георгий Дмитриевич

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    var username = msg.from.username;
    if (spl.length < 2) {
        sendMessage(chatId, "Usage: " + spl[0] + " <FIO as in table>\nExample: " + spl[0] + " Лебедев Георгий Дмитриевич");
        return
    }
    if (chatId !== userId) {
        sendMessage(chatId, "This command only works in private messages!");
        return;
    }
    var sheet = SPREADSHEET.getSheetByName("DB_STUDENTS");
    var fioParts = [];
    for (var i = 1; i < spl.length; i++)
        fioParts.push(spl[i]);
    var fio = fioParts.join(" ");
    var id = dbGetRowIdFromFio(sheet, fio);
    if (id == null) {
        sendMessage(chatId, "FIO not found in DB. If you think it's a mistake on bot's side, contact admins.");
        return;
    }
    if (dbGetData(sheet, id, "TG_ID") !== "") {
        sendMessage(chatId, "FIO is occupied or is in process of registration.");
        return;
    }
    dbPutData(sheet, id, "TG_ID", msg.from.id);
    if (username !== undefined)
        dbPutData(sheet, id, "TG_USERNAME", username);
    dbPutData(sheet, id, "VERIFIED", "0");
    var regRequest =
        "*Got a registration request:*\n\n" +
        "*FIO:* " + fio + "\n" +
        "*TG_ID:* [" + userId + "](tg://user?id=" + userId + ")";
    sendMessage(64259726, regRequest,
        [[
        {"text": "Approve", "callback_data": ["regAns", 1, userId].join(",")},
        {"text": "Decline", "callback_data": ["regAns", 0, userId].join(",")}
        ]]
    );
    sendMessage(chatId, "Your registration request was sent to the administrator.")
}

function cmdMark(spl, msg) {
    // USAGE: /mark <sheet> <task(s)>
    // EXAMPLE: /mark ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isVerified(userId)) {
        sendMessage(chatId, "You weren't verified or registered.");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheetName = spl[1] + "/" + getGroupForTgId(SPREADSHEET.getSheetByName("DB_STUDENTS"), userId);
    var sheet = SPREADSHEET.getSheetByName(sheetName);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    uncompTasks.forEach(function (item) {
        if (isTaskExists(sheet, item) && !isTaskLocked(sheet, item) && !isTaskMarked(sheet, userId, item)) {
            markTask(sheet, userId, item);
            goodTasks.push(item)
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully marked tasks: " + goodTasks.join(", ") + "!" : "No tasks were marked!")
}

function cmdUnmark(spl, msg) {
    // USAGE: /unmark <sheet> <task(s)>
    // EXAMPLE: /unmark ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isVerified(userId)) {
        sendMessage(chatId, "You weren't verified or registered.");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheetName = spl[1] + "/" + getGroupForTgId(SPREADSHEET.getSheetByName("DB_STUDENTS"), userId);
    var sheet = SPREADSHEET.getSheetByName(sheetName);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    uncompTasks.forEach(function (item) {
        if (isTaskExists(sheet, item) && !isTaskLocked(sheet, item) && isTaskMarked(sheet, userId, item) && !isTaskQuestioned(sheet, userId, item)) {
            unmarkTask(sheet, userId, item);
            goodTasks.push(item)
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully unmarked tasks: " + goodTasks.join(", ") + "!" : "No tasks were unmarked!")
}

function cmdStart(spl, msg) {
    // USAGE: /start

    var chatId = msg.chat.id;
    sendMessage(chatId, "Welcome! List of commands:\n" +
        "/register <FIO as in table> - register yourself in the table\n" +
        "/mark <sheet> <task(s)> - mark your solutions on tasks in table\n" +
        "/unmark <sheet> <task(s)> - unmark your solutions on tasks in table\n" +
        "/queue <task> - make a queue entry. Please, write use this command only ONCE by queueing for your minimal task while you're in the table\n" +
        "/link - link to the table")
}

function cmdAddTasks(spl, msg) {
    // USAGE: /addTasks <sheet> <task(s)>
    // EXAMPLE: /addTasks ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isAdmin(userId)) {
        sendMessage(chatId, "Command not found");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheet = SPREADSHEET.getSheetByName(spl[1]);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    uncompTasks.forEach(function (item) {
        if (!isTaskExists(sheet, item)) {
            addTask(sheet, item);
            goodTasks.push(item)
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully added tasks: " + goodTasks.join(", ") + "!" : "No tasks were added!")
}

function cmdLink(spl, msg) {
    // USAGE: /link

    var chatId = msg.chat.id;
    sendMessage(chatId, "*Link: *\n" +
        "https://docs.google.com/spreadsheets/d/10R5UhuwIYelODj7FCtI8oF9c7Nznv6GWWRVItPXtvu0/edit#gid=0")
}

function cmdDistr(spl, msg) {
    // USAGE: /distr <sheet> <task(s)>
    // EXAMPLE: /distr ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isAdmin(userId)) {
        sendMessage(chatId, "Command not found");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheet = SPREADSHEET.getSheetByName(spl[1]);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }

    var map = sheet.getRange("C3:27").getValues();
    var data = {
        "fioToTasks": {},
        "taskToFios": {}
    };
    for (var key in CACHE[spl[1]]["rowToFio"]) {
        if (CACHE[spl[1]]["rowToFio"].hasOwnProperty(key)) {
            data["fioToTasks"][CACHE[spl[1]]["rowToFio"][key]] = [];
        }
    }
    var taskToSel = {};
    uncompTasks.forEach(function (item) {
        data["taskToFios"][item] = [];
        taskToSel[item] = "";
    });
    for (var j = 0; j < map[0].length; j++) {
        var task = CACHE[spl[1]]["colToTask"][j + 3].toString();
        if (data["taskToFios"][task] === undefined)
            continue;
        for (var i = 0; i < map.length; i++) {
            var fio = CACHE[spl[1]]["rowToFio"][i + 3];
            if (map[i][j] === "+") {
                data["fioToTasks"][fio].push(task);
                data["taskToFios"][task].push(fio);
            }
        }
    }
    uncompTasks.sort(function (a, b) {
        if (data["taskToFios"][a].length < data["taskToFios"][b].length)
            return -1;
        else if (data["taskToFios"][a].length > data["taskToFios"][b].length)
            return 1;
        else
            return 0;
    });
    var coffins = [];
    var overflow = [];
    var selected = [];
    uncompTasks.forEach(function (task) {
        if (data["taskToFios"][task].length === 0) {
            coffins.push(task);
            return
        }
        var candidates = [];
        data["taskToFios"][task].forEach(function (fio) {
            var sel = false;
            for (var i = 0; i < selected.length; i++) {
                if (selected[i] === fio) {
                    sel = true;
                    break;
                }
            }
            if (!sel)
                candidates.push(fio)
        });
        if (candidates.length === 0) {
            overflow.push(task);
            return;
        }
        var scoreToArr = {};
        var scores = [];
        candidates.forEach(function (fio) {
            var score = Math.floor(CACHE[spl[1]]["fioToAc"][fio]);
            if (scoreToArr[score] === undefined) {
                scoreToArr[score] = [];
                scores.push(score);
            }
            scoreToArr[score].push(fio);
        });
        scores.sort();
        var selection = scoreToArr[scores[0]][Math.floor(Math.random() * scoreToArr[scores[0]].length)];
        selected.push(selection);
        taskToSel[task] = selection;
        questionTask(sheet, selection, task);
    });

    var res = "*=== Distribution ===*";
    for (var k in taskToSel) {
        if (taskToSel.hasOwnProperty(k) && taskToSel[k] !== "")
            res += "\n" + k + " - " + taskToSel[k] + " (marked by " + data["taskToFios"][k].length + ", score " + CACHE[spl[1]]["fioToAc"][taskToSel[k]] + ")";
    }
    if (coffins.length > 0)
        res += "\n\n*Coffins:* " + coffins.join(", ");
    if (overflow.length > 0)
        res += "\n\n*Overflowed:* " + overflow.join(", ");
    sendMessage(chatId, res)
}

function cmdOk(spl, msg) {
    // USAGE: /ok <sheet> <task(s)>
    // EXAMPLE: /ok ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isAdmin(userId)) {
        sendMessage(chatId, "Command not found");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheet = SPREADSHEET.getSheetByName(spl[1]);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    var map = sheet.getRange("C3:27").getValues();
    uncompTasks.forEach(function (item) {
        if (isTaskExists(sheet, item)) {
            var row = getQuestionedRow(sheet, item, map);
            if (row != null) {
                acceptTask(sheet, row, item);
                lockTask(sheet, item);
                goodTasks.push(item)
            }
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully accepted tasks: " + goodTasks.join(", ") + "!" : "No tasks were accepted!")
}

function cmdFail(spl, msg) {
    // USAGE: /fail <sheet> <task(s)>
    // EXAMPLE: /fail ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isAdmin(userId)) {
        sendMessage(chatId, "Command not found");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheet = SPREADSHEET.getSheetByName(spl[1]);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    var map = sheet.getRange("C3:27").getValues();
    uncompTasks.forEach(function (item) {
        if (isTaskExists(sheet, item)) {
            var row = getQuestionedRow(sheet, item, map);
            if (row != null) {
                failTask(sheet, row, item);
                goodTasks.push(item)
            }
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully failed tasks: " + goodTasks.join(", ") + "!" : "No tasks were failed!")
}

function cmdUnquestion(spl, msg) {
    // USAGE: /unquestion <sheet> <task(s)>
    // EXAMPLE: /unquestion ALGO 1.1-1.5,1.7

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isAdmin(userId)) {
        sendMessage(chatId, "Command not found");
        return;
    }
    if (spl.length < 3) {
        sendMessage(chatId, "Usage: " + spl[0] + " <sheet> <task(s)>\nExample: " + spl[0] + " ALGO 1.2-1.5,1.7");
        return
    }
    var sheet = SPREADSHEET.getSheetByName(spl[1]);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    cacheTasksAndNames(sheet);
    var allTasks = spl[2];
    for (var i = 3; i < spl.length; i++) {
        allTasks += "," + spl[i];
    }
    var uncompTasks = uncompressTaskList(allTasks);
    if (uncompTasks.length === 2 && uncompTasks[0] === "ERROR") {
        sendMessage(chatId, uncompTasks[1]);
        return
    }
    var goodTasks = [];
    var map = sheet.getRange("C3:27").getValues();
    uncompTasks.forEach(function (item) {
        if (isTaskExists(sheet, item)) {
            var row = getQuestionedRow(sheet, item, map);
            if (row != null) {
                markTaskByRow(sheet, row, item);
                goodTasks.push(item)
            }
        }
    });
    sendMessage(chatId, goodTasks.length !== 0 ? "Successfully unquestioned tasks: " + goodTasks.join(", ") + "!" : "No tasks were unquestioned!")
}

function cmdQueue(spl, msg) {
    // USAGE: /queue <task>
    // EXAMPLE: /queue 5

    var chatId = msg.chat.id;
    var userId = msg.from.id;
    if (!isVerified(userId)) {
        sendMessage(chatId, "You weren't verified or registered.");
        return;
    }
    if (spl.length < 2) {
        sendMessage(chatId, "Usage: " + spl[0] + " <task>\nExample: " + spl[0] + "5");
        return
    }
    var d = new Date();
    if (getConfigValue("QUEUE_UNLOCK_PERIOD") != 1) {
        var day = getConfigValue("QUEUE_DAY");
        var minTime = getConfigValue("QUEUE_MIN_TIME");
        var maxTime = getConfigValue("QUEUE_MAX_TIME");
        var curTime = d.getHours() * 60 + d.getMinutes();
        if (d.getDay() != day || curTime < minTime || curTime >= maxTime) {
            sendMessage(chatId, "Error: queuing is not allowed right now.");
            return
        }
    }
    var task = parseInt(spl[1]);
    if (isNaN(task)) {
        sendMessage(chatId, "Error: \"" + spl[1] + "\" is not a number");
        return
    }
    if (task < getConfigValue("PROG_MIN_TASK") || task > getConfigValue("PROG_MAX_TASK")) {
        sendMessage(chatId, "Error: \"" + spl[1] + "\" is not a task allowed to queue for");
        return
    }
    var sheetName = "PROG/" + getGroupForTgId(SPREADSHEET.getSheetByName("DB_STUDENTS"), userId);
    var sheet = SPREADSHEET.getSheetByName(sheetName);
    if (sheet == null) {
        sendMessage(chatId, "Error: sheet \"" + spl[1] + "\" not found");
        return
    }
    //cacheTasksAndNames(sheet);
    
    sheet.appendRow([d, CACHE["DB_STUDENTS"]["idToFio"][userId], task]);
    sendMessage(chatId, "Successfully queued for task " + task + "!")
}

function dbGetData(sheet, id, col) {
    return sheet.getRange(id, CACHE["DB_STUDENTS"]["cols"][col]).getValue();
}

function dbPutData(sheet, id, col, data) {
    sheet.getRange(id, CACHE["DB_STUDENTS"]["cols"][col]).setValue(data)
}

function dbGetRowIdFromFio(sheet, fio) {
    var vals = sheet.getRange("A2:A").getValues();
    for (var i = 0; i < vals.length; i++) {
        if (vals[i][0] === fio)
            return i + 2
    }
    return null;
}

function dbGetRowIdFromTgId(sheet, id) {
    var vals = sheet.getRange("B2:B").getValues();
    for (var i = 0; i < vals.length; i++) {
        if (vals[i][0].toString() === id.toString())
            return i + 2
    }
    return null;
}

function uncompressTaskList(taskList) {
    var tasks = taskList.split(",");
    var uncompTasks = [];
    var err = "";
    tasks.forEach(function (item) {
        if (item.length === 0) {
            return;
        }
        var compTasks = item.split("-");
        if (compTasks.length === 1) {
            uncompTasks.push(item)
        } else {
            if (compTasks[0].split(".").length === 1) {
                // Usual tasks, like in DM (1-5,7)
                for (var j = parseInt(compTasks[0]); j <= parseInt(compTasks[1]); j++)
                    uncompTasks.push(j.toString())
            }
            else {
                if (compTasks[1].split(".").length === 1) {
                    // Shorter A&DS notation (1.1-5), suggested by one good person
                    // noinspection JSDuplicatedDeclaration
                    for (var k = parseInt(compTasks[0].split(".")[1]); k <= parseInt(compTasks[1]); k++)
                        uncompTasks.push(compTasks[0].split(".")[0] + "." + k.toString())
                }
                else {
                    // Task with chapters like in A&DS (1.1-1.5,1.7)
                    if (compTasks[0].split(".")[0] !== compTasks[1].split(".")[0]) {
                        err = "Please, use the same chapter in task when using dash (1.1-1.5)!"
                    } else {
                        for (var k = parseInt(compTasks[0].split(".")[1]); k <= parseInt(compTasks[1].split(".")[1]); k++)
                            uncompTasks.push(compTasks[0].split(".")[0] + "." + k.toString())
                    }
                }
            }
        }
    });
    return err !== "" ? ["ERROR", err] : uncompTasks;
}

function cacheTasksAndNames(sheet) {
    var sheetName = sheet.getSheetName();
    CACHE[sheetName] = {
        "tasks": {},
        "fios": {},
        "colToTask": {},
        "rowToFio": {},
        "fioToAc": {}
    };
    var range = sheet.getRange("C1:1").getValues();
    for (var i = 0; i < range[0].length; i++) {
        CACHE[sheetName]["tasks"][range[0][i]] = i + 3;
        CACHE[sheetName]["colToTask"][i + 3] = range[0][i];
    }
    range = sheet.getRange("A3:B").getValues();
    for (var j = 0; j < range.length; j++) {
        CACHE[sheetName]["fios"][range[j][0]] = j + 3;
        CACHE[sheetName]["fioToAc"][range[j][0]] = range[j][1];
        CACHE[sheetName]["rowToFio"][j + 3] = range[j][0];
    }
}

function cacheDb(sheet) {
    var sheetName = sheet.getSheetName();
    CACHE[sheetName] = {
        "cols": {},
        "idToFio": {},
        "fioToId": {}
    };
    var range = sheet.getRange("A1:1").getValues();
    for (var i = 0; i < range[0].length; i++)
        CACHE[sheetName]["cols"][range[0][i]] = i + 1;
    range = sheet.getRange("A2:B").getValues();
    for (var j = 0; j < range.length; j++)
        if (range[j][1] !== "")
            CACHE[sheetName]["idToFio"][range[j][1]] = range[j][0];
}

function cacheConfig(sheet) {
    var sheetName = sheet.getSheetName();
    CACHE[sheetName] = {
        "optionToId": {},
        "kv": {},
    };
    var range = sheet.getRange("A1:B").getValues();
    for (var i = 0; i < range.length; i++) {
        CACHE[sheetName]["optionToId"][range[i][0]] = i + 1;
        CACHE[sheetName]["kv"][range[i][0]] = range[i][1];
    }
}

function getGroupForTgId(sheet, id) {
    var row = dbGetRowIdFromTgId(sheet, id);
    return dbGetData(sheet, row, "GROUP")
}

function isTaskExists(sheet, task) {
    return CACHE[sheet.getSheetName()]["tasks"][task] !== undefined
}

function lockTask(sheet, task) {
    sheet.getRange(2, CACHE[sheet.getSheetName()]["tasks"][task]).setValue("F");
}

function markTask(sheet, userId, task) {
    var sheetName = sheet.getSheetName();
    sheet.getRange(CACHE[sheetName]["fios"][CACHE["DB_STUDENTS"]["idToFio"][userId]], CACHE[sheetName]["tasks"][task])
        .setValue("'+");
}

function markTaskByRow(sheet, row, task) {
    var sheetName = sheet.getSheetName();
    sheet.getRange(row, CACHE[sheetName]["tasks"][task])
        .setValue("'+");
}

function questionTask(sheet, fio, task) {
    var sheetName = sheet.getSheetName();
    sheet.getRange(CACHE[sheetName]["fios"][fio], CACHE[sheetName]["tasks"][task])
        .setValue("?");
}

function acceptTask(sheet, row, task) {
    var sheetName = sheet.getSheetName();
    sheet.getRange(row, CACHE[sheetName]["tasks"][task])
        .setValue("'++");
}

function failTask(sheet, row, task) {
    var sheetName = sheet.getSheetName();
    sheet.getRange(row, CACHE[sheetName]["tasks"][task])
        .setValue("-");
}

function unmarkTask(sheet, userId, task) {
    var sheetName = sheet.getSheetName();
    sheet.getRange(CACHE[sheetName]["fios"][CACHE["DB_STUDENTS"]["idToFio"][userId]], CACHE[sheetName]["tasks"][task])
        .setValue("");
}

function unlockTask(sheet, task) {
    sheet.getRange(2, CACHE[sheet.getSheetName()]["tasks"][task]).setValue("");
}

function addTask(sheet, task) {
    var sheetName = sheet.getSheetName();
    var tasks = Object.keys(CACHE[sheetName]["tasks"]).length;
    sheet.insertColumnsAfter(tasks + 2, 1);
    sheet.getRange(1, tasks + 3).setValue(task);
    CACHE[sheetName]["tasks"][task] = tasks + 3;
}

function isTaskLocked(sheet, task) {
    return sheet.getRange(2, CACHE[sheet.getSheetName()]["tasks"][task]).getValue() === "F";
}

function isTaskMarked(sheet, userId, task) {
    var sheetName = sheet.getSheetName();
    var val = sheet.getRange(CACHE[sheetName]["fios"][CACHE["DB_STUDENTS"]["idToFio"][userId]], CACHE[sheetName]["tasks"][task]).getValue();
    return val === "+" || val === "?" || val === "++";
}

function isTaskQuestioned(sheet, userId, task) {
    var sheetName = sheet.getSheetName();
    return sheet.getRange(CACHE[sheetName]["fios"][CACHE["DB_STUDENTS"]["idToFio"][userId]], CACHE[sheetName]["tasks"][task]).getValue() === "?";
}

function isVerified(userId) {
    var sheet = SPREADSHEET.getSheetByName("DB_STUDENTS");
    var id = dbGetRowIdFromTgId(sheet, userId);
    if (id == null)
        return false;
    return dbGetData(sheet, id, "VERIFIED").toString() === "1";
}

function getQuestionedRow(sheet, task, map) {
    var sheetName = sheet.getSheetName();
    for (var i = 0; i < map.length; i++) {
        if (map[i][CACHE[sheetName]["tasks"][task] - 3] === "?")
            return i + 3;
    }
    return null;
}

function getConfigValue(key) {
    return CACHE["CONFIG"]["kv"][key];
}

function setConfigValue(key, value) {
    SPREADSHEET.getSheetByName("CONFIG").getRange(CACHE["CONFIG"]["optionToId"][key], 2).setValue(value);
}

function isAdmin(username) {
    for (var i = 0; i < ADMINS.length; i++)
        if (ADMINS[i] === username)
            return true;
    return false
}

function isAdminOnly() {
    return getConfigValue("ADMIN_ONLY") == 1;
}

function log(msg) {
    var name = CACHE["DB_STUDENTS"]["idToFio"][msg.from.id];
    if (name === undefined) {
        name = msg.from.first_name;
        if (msg.from.last_name !== undefined)
            name += " " + msg.from.last_name;
    }
    SPREADSHEET.getSheetByName("LOG").appendRow([msg.from.id, name, Date(), msg.text])
}

function sendMessage(chatId, message, buttons) {
    var payload = {
        "method": "sendMessage",
        "chat_id": String(chatId),
        "text": message,
        "parse_mode": "Markdown"
    };
    if (buttons !== undefined) {
        payload.reply_markup = JSON.stringify({
            "inline_keyboard": buttons
        });
    }
    var data = {
        "method": "post",
        "payload": payload
    };

    UrlFetchApp.fetch('https://api.telegram.org/bot' + API_TOKEN + '/', data);
}

function editMessageText(chat_id, msg_id, message) {
    var payload = {
        "method": "editMessageText",
        "chat_id": String(chat_id),
        "message_id": msg_id,
        "text": message,
        "parse_mode": "Markdown"
    };
    var data = {
        "method": "post",
        "payload": payload
    };

    UrlFetchApp.fetch('https://api.telegram.org/bot' + API_TOKEN + '/', data);
}