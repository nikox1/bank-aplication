package pl.nikodem.bankapp.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import pl.nikodem.bankapp.R;
import pl.nikodem.bankapp.adapters.TransactionAdapter;
import pl.nikodem.bankapp.api.RetrofitClient;
import pl.nikodem.bankapp.models.ApiResponse;
import pl.nikodem.bankapp.models.Transaction;
import pl.nikodem.bankapp.utils.SharedPrefManager;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HistoryActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private TransactionAdapter adapter;
    private ProgressBar progressBar;
    private TextView tvEmpty;
    private SwipeRefreshLayout swipeRefresh;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_history);

        initViews();
        loadTransactions();

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
    }

    private void initViews() {
        recyclerView = findViewById(R.id.recyclerView);
        progressBar = findViewById(R.id.progressBar);
        tvEmpty = findViewById(R.id.tvEmpty);
        swipeRefresh = findViewById(R.id.swipeRefresh);

        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new TransactionAdapter(new ArrayList<>());
        recyclerView.setAdapter(adapter);

        swipeRefresh.setOnRefreshListener(this::loadTransactions);
    }

    private void loadTransactions() {
        progressBar.setVisibility(View.VISIBLE);
        tvEmpty.setVisibility(View.GONE);

        String token = "Bearer " + SharedPrefManager.getInstance(this).getToken();

        RetrofitClient.getInstance().getApiService()
                .getTransactions(token)
                .enqueue(new Callback<ApiResponse>() {
                    @Override
                    public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                        progressBar.setVisibility(View.GONE);
                        swipeRefresh.setRefreshing(false);

                        if (response.isSuccessful() && response.body() != null) {
                            ApiResponse apiResponse = response.body();
                            List<Transaction> transactions = apiResponse.getTransactions();

                            if (transactions != null && !transactions.isEmpty()) {
                                adapter.updateData(transactions);
                                recyclerView.setVisibility(View.VISIBLE);
                                tvEmpty.setVisibility(View.GONE);
                            } else {
                                recyclerView.setVisibility(View.GONE);
                                tvEmpty.setVisibility(View.VISIBLE);
                            }
                        } else {
                            Toast.makeText(HistoryActivity.this,
                                    "Failed to load transactions",
                                    Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<ApiResponse> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        swipeRefresh.setRefreshing(false);
                        Toast.makeText(HistoryActivity.this,
                                "Connection error: " + t.getMessage(),
                                Toast.LENGTH_SHORT).show();
                    }
                });
    }
}
