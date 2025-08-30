-- Drop OfficePools tables from KidsActivityTracker database
DROP TABLE IF EXISTS chat_read_status CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS football_squares CASCADE;
DROP TABLE IF EXISTS game_odds CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS mailing_list_contacts CASCADE;
DROP TABLE IF EXISTS mailing_lists CASCADE;
DROP TABLE IF EXISTS nfl_state CASCADE;
DROP TABLE IF EXISTS nfl_teams CASCADE;
DROP TABLE IF EXISTS nfl_weeks CASCADE;
DROP TABLE IF EXISTS pick_unlock_states CASCADE;
DROP TABLE IF EXISTS picks CASCADE;
DROP TABLE IF EXISTS pool_announcements CASCADE;
DROP TABLE IF EXISTS pool_invitations CASCADE;
DROP TABLE IF EXISTS pool_participants CASCADE;
DROP TABLE IF EXISTS pools CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS squares_payout_config CASCADE;
DROP TABLE IF EXISTS squares_winners CASCADE;
DROP TABLE IF EXISTS survivor_entries CASCADE;
DROP TABLE IF EXISTS survivor_picks CASCADE;
DROP TABLE IF EXISTS team_logos CASCADE;
DROP TABLE IF EXISTS test_executions CASCADE;
DROP TABLE IF EXISTS test_validations CASCADE;
DROP TABLE IF EXISTS user_statistics CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop OfficePools enums
DROP TYPE IF EXISTS enum_pick_unlock_states_pool_type CASCADE;
DROP TYPE IF EXISTS enum_pool_invitations_status CASCADE;
DROP TYPE IF EXISTS enum_pool_participants_payment_status CASCADE;
DROP TYPE IF EXISTS enum_squares_payout_config_quarter CASCADE;
DROP TYPE IF EXISTS enum_squares_winners_quarter CASCADE;
DROP TYPE IF EXISTS enum_users_admin_type CASCADE;
