import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'userdashboard.dart';

const String backendBaseUrl = 'http://127.0.0.1:5000';

class MyTaskPage extends StatefulWidget {
  const MyTaskPage({super.key});

  @override
  State<MyTaskPage> createState() => _MyTaskPageState();
}

class _MyTaskPageState extends State<MyTaskPage> {
  final _taskController = TextEditingController();
  String _selectedPriority = 'Medium';
  String _selectedStatus = 'To Do';
  bool _taskInteractionSent = false;

  @override
  void initState() {
    super.initState();
    if (!_taskInteractionSent && AppState.tasks.length > 2) {
      _sendTaskInteractionEvent();
      _taskInteractionSent = true;
    }
  }

  void _addTask() {
    if (_taskController.text.isNotEmpty) {
      setState(() {
        AppState.tasks.insert(0, {
          'title': _taskController.text,
          'deadline': 'Today, 6:00 PM',
          'priority': _selectedPriority,
          'status': _selectedStatus,
          'color': _getPriorityColor(_selectedPriority),
        });
      });
      _taskController.clear();
      Navigator.pop(context);

      // Track interaction when task is added
      InteractionTracker.trackButtonClick();

      // If user now has more than 2 tasks, send interaction event
      if (AppState.tasks.length > 2 && !_taskInteractionSent) {
        _sendTaskInteractionEvent();
        _taskInteractionSent = true;
      }
    }
  }

  Future<void> _sendTaskInteractionEvent() async {
    final interactionData = InteractionTracker.getInteractionData();
    InteractionTracker.recordLiveEvent('User created task: now has ${AppState.tasks.length} tasks');
    
    try {
      final response = await http.post(
        Uri.parse('$backendBaseUrl/session'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': AppState.currentUserEmail.isEmpty ? 'anonymous_user' : AppState.currentUserEmail,
          'device': 'user_dashboard',
          'event': 'user_task_interaction',
          'keystroke_interval': 0,
          'interaction_data': {
            ...interactionData,
            'task_count': AppState.tasks.length,
          },
        }),
      );

      if (response.statusCode != 200) {
        print('Failed to send task interaction: ${response.body}');
      }
    } catch (e) {
      print('Error sending task interaction: $e');
    }
  }

  Color _getPriorityColor(String priority) {
    switch (priority) {
      case 'High': return Colors.redAccent;
      case 'Medium': return Colors.blueAccent;
      case 'Low': return Colors.greenAccent;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9FF),
      appBar: AppBar(
        title: const Text('My Tasks', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF0369A1),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddTaskDialog(),
        label: const Text('New Task'),
        icon: const Icon(Icons.add),
        backgroundColor: const Color(0xFF0EA5E9),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(24),
        itemCount: AppState.tasks.length,
        itemBuilder: (context, index) {
          final task = AppState.tasks[index];
          return Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10),
              ],
            ),
            child: Row(
              children: [
                Checkbox(
                  value: task['status'] == 'Done',
                  onChanged: (val) {
                    setState(() {
                      task['status'] = val! ? 'Done' : 'To Do';
                    });
                  },
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task['title'],
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          decoration: task['status'] == 'Done' ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      Text(task['deadline'], style: const TextStyle(color: Colors.grey, fontSize: 13)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: task['color'].withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        task['priority'],
                        style: TextStyle(color: task['color'], fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      task['status'],
                      style: TextStyle(color: Colors.blueGrey, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showAddTaskDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add New Task'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _taskController,
              decoration: const InputDecoration(hintText: 'Task Title'),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _selectedPriority,
              items: ['High', 'Medium', 'Low'].map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
              onChanged: (val) => _selectedPriority = val!,
              decoration: const InputDecoration(labelText: 'Priority'),
            ),
            DropdownButtonFormField<String>(
              initialValue: _selectedStatus,
              items: ['To Do', 'In Progress', 'Done'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: (val) => _selectedStatus = val!,
              decoration: const InputDecoration(labelText: 'Status'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(onPressed: _addTask, child: const Text('Add Task')),
        ],
      ),
    );
  }
}
