// 全局变量
let currentWeek = 1;
let semesterStart = new Date(2025, 8, 1); // 注意：月份从0开始，9月是8
let userId = null;
let sessionId = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeWeekSelect();
    updateLoginStatus();
    loadConfig();
});

// 加载配置
function loadConfig() {
    if (CONFIG.DEFAULT_SEMESTER_START) {
        document.getElementById('year').value = CONFIG.DEFAULT_SEMESTER_START.year;
        document.getElementById('month').value = CONFIG.DEFAULT_SEMESTER_START.month;
        document.getElementById('day').value = CONFIG.DEFAULT_SEMESTER_START.day;
        semesterStart = new Date(
            CONFIG.DEFAULT_SEMESTER_START.year,
            CONFIG.DEFAULT_SEMESTER_START.month - 1,
            CONFIG.DEFAULT_SEMESTER_START.day
        );
    }
}

// 初始化周数选择器
function initializeWeekSelect() {
    const weekSelect = document.getElementById('weekSelect');
    weekSelect.innerHTML = '';
    
    for (let i = 1; i <= 18; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `第 ${i} 周`;
        weekSelect.appendChild(option);
    }
    weekSelect.value = currentWeek;
}

// 更新登录状态显示
function updateLoginStatus() {
    const statusElement = document.getElementById('loginStatus');
    if (userId && sessionId) {
        statusElement.innerHTML = '<i class="fas fa-circle text-success"></i> 已登录';
    } else {
        statusElement.innerHTML = '<i class="fas fa-circle text-danger"></i> 未登录';
    }
}

// 设置状态消息
function setStatusMessage(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    
    statusElement.textContent = `${icons[type] || icons.info} ${message}`;
    statusElement.className = `text-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'}`;
}

// 添加日志
function addLog(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `[${timestamp}] ${icons[type]} ${message}`;
    
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
}

// 显示加载动画
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

// 隐藏加载动画
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// API调用封装 - 直接调用（可能遇到CORS问题）
async function apiCall(url, options = {}) {
    showLoading();
    
    try {
        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT || 10000);
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 尝试解析JSON，如果失败则返回文本
        try {
            return await response.json();
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error('API调用错误:', error);
        if (error.name === 'AbortError') {
            throw new Error('请求超时');
        }
        throw error;
    } finally {
        hideLoading();
    }
}

// 登录功能 - 直接调用北航API
async function login() {
    const studentId = document.getElementById('studentId').value.trim();
    const year = document.getElementById('year').value;
    const month = document.getElementById('month').value;
    const day = document.getElementById('day').value;
    
    if (!studentId) {
        setStatusMessage('请输入学号', 'error');
        return;
    }
    
    
    setStatusMessage('正在登录...', 'info');
    addLog('开始登录系统', 'info');
    
    try {
        const url = `https://iclass.buaa.edu.cn:8346/app/user/login.action?password=&phone=${studentId}&userLevel=1&verificationType=2&verificationUrl=`;
        
        const result = await apiCall(url);
        
        if (result.STATUS === '0') {
            userId = result.result.id;
            sessionId = result.result.sessionId;
            
            setStatusMessage('登录成功', 'success');
            addLog('登录成功', 'success');
            updateLoginStatus();
            
            // 保存学期开始日期
            semesterStart = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            
            // 登录后加载当前周课表
            jumpToCurrentWeek();
        } else {
            const errorMsg = result.ERRORMSG || '未知错误';
            setStatusMessage(`登录失败: ${errorMsg}`, 'error');
            addLog(`登录失败: ${errorMsg}`, 'error');
        }
    } catch (error) {
        setStatusMessage(`登录失败: ${error.message}`, 'error');
        addLog(`登录失败: ${error.message}`, 'error');
    }
}

// 计算周日期
function calculateWeekDates(weekNumber) {
    const startDate = new Date(semesterStart);
    startDate.setDate(semesterStart.getDate() + (weekNumber - 1) * 7);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        dates.push(date);
    }
    return dates;
}

// 格式化日期为YYYYMMDD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// 获取课程信息
async function getCourses(dateStr) {
    if (!userId || !sessionId) {
        throw new Error('请先登录');
    }
    
    const url = `https://iclass.buaa.edu.cn:8346/app/course/get_stu_course_sched.action?dateStr=${dateStr}&id=${userId}`;
    
    const result = await apiCall(url, {
        headers: {
            'sessionId': sessionId
        }
    });
    
    if (result.STATUS === '0') {
        return result.result || [];
    } else {
        throw new Error(result.ERRORMSG || '获取课程失败');
    }
}

// 加载周课程
async function loadWeekCourses() {
    if (!userId || !sessionId) {
        setStatusMessage('请先登录', 'warning');
        return;
    }
    
    const weekNumber = parseInt(document.getElementById('weekSelect').value);
    const weekDates = calculateWeekDates(weekNumber);
    
    setStatusMessage(`正在加载第 ${weekNumber} 周课表...`, 'info');
    addLog(`开始加载第 ${weekNumber} 周课表`, 'info');
    
    // 更新周头部
    updateWeekHeaders(weekDates);
    
    // 清空课程容器
    const coursesContainer = document.getElementById('coursesContainer');
    coursesContainer.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';
    
    try {
        // 获取每天课程
        const allCourses = [];
        for (let i = 0; i < weekDates.length; i++) {
            const dateStr = formatDate(weekDates[i]);
            try {
                const courses = await getCourses(dateStr);
                allCourses[i] = courses;
            } catch (error) {
                allCourses[i] = [];
                addLog(`获取 ${dateStr} 课程失败: ${error.message}`, 'error');
            }
        }
        
        // 显示课程
        displayWeekCourses(allCourses, weekDates);
        setStatusMessage(`第 ${weekNumber} 周课表加载完成`, 'success');
        addLog(`第 ${weekNumber} 周课表加载完成`, 'success');
    } catch (error) {
        setStatusMessage(`加载课表失败: ${error.message}`, 'error');
        addLog(`加载课表失败: ${error.message}`, 'error');
    }
}

// 更新周头部
function updateWeekHeaders(weekDates) {
    const weekHeaders = document.getElementById('weekHeaders');
    const days = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    
    weekHeaders.innerHTML = '';
    
    weekDates.forEach((date, index) => {
        const isToday = isSameDay(date, new Date());
        const col = document.createElement('div');
        col.className = 'col';
        
        col.innerHTML = `
            <div class="day-header ${isToday ? 'today bg-primary text-white' : 'bg-light'}">
                <div class="fw-bold">${days[index]}</div>
                <div class="small">${formatDisplayDate(date)}</div>
            </div>
        `;
        
        weekHeaders.appendChild(col);
    });
}

// 显示周课程
function displayWeekCourses(coursesByDay, weekDates) {
    const coursesContainer = document.getElementById('coursesContainer');
    coursesContainer.innerHTML = '';
    
    coursesByDay.forEach((courses, dayIndex) => {
        const col = document.createElement('div');
        col.className = 'col';
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'week-day';
        
        if (!courses || courses.length === 0) {
            dayDiv.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-party-horn fa-2x mb-2"></i><br>
                    无课程安排
                </div>
            `;
        } else {
            courses.forEach(course => {
                const courseCard = createCourseCard(course);
                dayDiv.appendChild(courseCard);
            });
        }
        
        col.appendChild(dayDiv);
        coursesContainer.appendChild(col);
    });
}

// 创建课程卡片
function createCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    
    const courseName = course.courseName || '未知课程';
    const location = course.classroomName || '未知地点';
    const teacher = course.teacherName || '未知教师';
    const classBegin = course.classBeginTime ? course.classBeginTime.substring(11, 16) : '--:--';
    const classEnd = course.classEndTime ? course.classEndTime.substring(11, 16) : '--:--';
    
    card.innerHTML = `
        <div class="course-title" title="${courseName}">${truncateText(courseName, 12)}</div>
        <div class="course-info">
            <i class="fas fa-clock"></i> ${classBegin} - ${classEnd}
        </div>
        <div class="course-info" title="${location}">
            <i class="fas fa-map-marker-alt"></i> ${truncateText(location, 12)}
        </div>
        <div class="course-info" title="${teacher}">
            <i class="fas fa-user"></i> ${truncateText(teacher, 10)}
        </div>
        <button class="btn btn-success btn-sm btn-sign" onclick="signCourse('${course.id}', '${courseName.replace(/'/g, "\\'")}')">
            <i class="fas fa-check"></i> 课程打卡
        </button>
    `;
    
    return card;
}

// 课程打卡
async function signCourse(courseId, courseName) {
    if (!userId) {
        setStatusMessage('请先登录', 'warning');
        return;
    }
    
    setStatusMessage(`正在为 ${courseName} 打卡...`, 'info');
    addLog(`开始打卡: ${courseName}`, 'info');
    
    try {
        const timestamp = Date.now();
        const url = `http://iclass.buaa.edu.cn:8081/app/course/stu_scan_sign.action?courseSchedId=${courseId}&timestamp=${timestamp}&id=${userId}`;
        
        const result = await apiCall(url, {
            method: 'POST'
        });
        
        let success = false;
        
        // 检查返回结果
        if (typeof result === 'object' && result.STATUS === '0') {
            success = true;
        } else if (typeof result === 'string' && (result.includes('成功') || result.includes('SUCCESS'))) {
            success = true;
        }
        
        if (success) {
            setStatusMessage(`打卡成功: ${courseName}`, 'success');
            addLog(`打卡成功: ${courseName}`, 'success');
        } else {
            setStatusMessage(`打卡失败: ${courseName}`, 'error');
            addLog(`打卡失败: ${courseName}`, 'error');
        }
    } catch (error) {
        setStatusMessage(`打卡失败: ${error.message}`, 'error');
        addLog(`打卡失败: ${error.message}`, 'error');
    }
}

// 一键打卡本周
async function batchSignWeek() {
    if (!userId || !sessionId) {
        setStatusMessage('请先登录', 'warning');
        return;
    }
    
    if (!CONFIG.FEATURES.BATCH_SIGN) {
        setStatusMessage('一键打卡功能已禁用', 'warning');
        return;
    }
    
    const weekNumber = parseInt(document.getElementById('weekSelect').value);
    const weekDates = calculateWeekDates(weekNumber);
    
    setStatusMessage(`正在一键打卡第 ${weekNumber} 周...`, 'info');
    addLog(`开始一键打卡第 ${weekNumber} 周所有课程`, 'info');
    
    try {
        let successCount = 0;
        let totalCount = 0;
        
        for (let i = 0; i < weekDates.length; i++) {
            const dateStr = formatDate(weekDates[i]);
            try {
                const courses = await getCourses(dateStr);
                
                for (const course of courses) {
                    totalCount++;
                    setStatusMessage(`正在打卡 (${totalCount}): ${truncateText(course.courseName, 15)}`, 'info');
                    
                    try {
                        const timestamp = Date.now();
                        const url = `http://iclass.buaa.edu.cn:8081/app/course/stu_scan_sign.action?courseSchedId=${course.id}&timestamp=${timestamp}&id=${userId}`;
                        
                        await apiCall(url, { method: 'POST' });
                        successCount++;
                        addLog(`打卡成功: ${course.courseName}`, 'success');
                    } catch (error) {
                        addLog(`打卡失败: ${course.courseName}`, 'error');
                    }
                    
                    // 延迟避免请求过快
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                addLog(`获取 ${dateStr} 课程失败: ${error.message}`, 'error');
            }
        }
        
        const message = `一键打卡完成: 成功 ${successCount} / ${totalCount} 门课程`;
        setStatusMessage(message, successCount === totalCount ? 'success' : 'warning');
        addLog(message, successCount === totalCount ? 'success' : 'warning');
    } catch (error) {
        setStatusMessage(`一键打卡失败: ${error.message}`, 'error');
        addLog(`一键打卡失败: ${error.message}`, 'error');
    }
}

// 工具函数
function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength - 3) + '...';
    }
    return text;
}

function formatDisplayDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function previousWeek() {
    const weekSelect = document.getElementById('weekSelect');
    if (parseInt(weekSelect.value) > 1) {
        weekSelect.value = parseInt(weekSelect.value) - 1;
        loadWeekCourses();
    }
}

function nextWeek() {
    const weekSelect = document.getElementById('weekSelect');
    if (parseInt(weekSelect.value) < 18) {
        weekSelect.value = parseInt(weekSelect.value) + 1;
        loadWeekCourses();
    }
}

function jumpToCurrentWeek() {
    const today = new Date();
    const timeDiff = today - semesterStart;
    const weekDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7)) + 1;
    const currentWeek = Math.max(1, Math.min(18, weekDiff));
    
    document.getElementById('weekSelect').value = currentWeek;
    loadWeekCourses();
}
